// Copyright (C) 2026 Benjamin Bonneton and the Cairn Foundry contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

//! Writes a `usage` line to the app log every few minutes: the memory and CPU
//! of Cairn and of every process it spawned (webview, terminals, agent CLIs,
//! language servers), the heaviest of them by name, and what the system has
//! left. A process killed under memory pressure then leaves its trend behind.

use std::collections::HashMap;
use std::fs;
use std::time::{Duration, Instant};

const INTERVAL: Duration = Duration::from_secs(300);
const TOP: usize = 5;

#[derive(Debug, Clone, PartialEq)]
struct Process {
    pid: u32,
    ppid: u32,
    name: String,
    ticks: u64,
    rss_kb: u64,
    swap_kb: u64,
}

struct Snapshot {
    at: Instant,
    ticks: HashMap<u32, u64>,
}

pub fn start() {
    let _ = std::thread::Builder::new().name("usage-log".into()).spawn(|| {
        // SAFETY: sysconf has no preconditions.
        let ticks_per_second = unsafe { libc::sysconf(libc::_SC_CLK_TCK) }.max(1) as f64;
        let mut previous = snapshot(&tree());
        loop {
            std::thread::sleep(INTERVAL);
            let processes = tree();
            let elapsed = previous.at.elapsed().as_secs_f64() * ticks_per_second;
            let (available_kb, swap_free_kb) = fs::read_to_string("/proc/meminfo")
                .map(|text| parse_meminfo(&text))
                .unwrap_or_default();
            crate::app_log::info(&usage_line(&processes, &previous.ticks, elapsed, available_kb, swap_free_kb));
            previous = snapshot(&processes);
        }
    });
}

fn snapshot(processes: &[Process]) -> Snapshot {
    Snapshot { at: Instant::now(), ticks: processes.iter().map(|p| (p.pid, p.ticks)).collect() }
}

/// This process and all its descendants, read from `/proc`.
fn tree() -> Vec<Process> {
    let Ok(entries) = fs::read_dir("/proc") else { return Vec::new() };
    let all: Vec<Process> = entries
        .flatten()
        .filter_map(|entry| entry.file_name().to_str()?.parse::<u32>().ok())
        .filter_map(|pid| {
            let (name, ppid, ticks) = parse_stat(&fs::read_to_string(format!("/proc/{pid}/stat")).ok()?)?;
            Some(Process { pid, ppid, name, ticks, rss_kb: 0, swap_kb: 0 })
        })
        .collect();
    descendants(std::process::id(), &all)
        .into_iter()
        .map(|mut process| {
            if let Ok(status) = fs::read_to_string(format!("/proc/{}/status", process.pid)) {
                (process.rss_kb, process.swap_kb) = parse_status(&status);
            }
            process
        })
        .collect()
}

fn descendants(root: u32, all: &[Process]) -> Vec<Process> {
    let mut found: Vec<Process> = all.iter().filter(|p| p.pid == root).cloned().collect();
    let mut next = 0;
    while next < found.len() {
        let parent = found[next].pid;
        found.extend(all.iter().filter(|p| p.ppid == parent && p.pid != root).cloned());
        next += 1;
    }
    found
}

/// Name, parent pid and CPU ticks (user + system) from `/proc/<pid>/stat`.
fn parse_stat(stat: &str) -> Option<(String, u32, u64)> {
    let open = stat.find('(')?;
    let close = stat.rfind(')')?;
    let name = stat.get(open + 1..close)?.to_string();
    let fields: Vec<&str> = stat.get(close + 1..)?.split_whitespace().collect();
    let ppid = fields.get(1)?.parse().ok()?;
    let utime: u64 = fields.get(11)?.parse().ok()?;
    let stime: u64 = fields.get(12)?.parse().ok()?;
    Some((name, ppid, utime + stime))
}

fn kb_field(text: &str, key: &str) -> u64 {
    text.lines()
        .find_map(|line| line.strip_prefix(key)?.split_whitespace().next()?.parse().ok())
        .unwrap_or(0)
}

/// Resident and swapped memory, in kB, from `/proc/<pid>/status`.
fn parse_status(status: &str) -> (u64, u64) {
    (kb_field(status, "VmRSS:"), kb_field(status, "VmSwap:"))
}

/// Available memory and free swap, in kB, from `/proc/meminfo`.
fn parse_meminfo(meminfo: &str) -> (u64, u64) {
    (kb_field(meminfo, "MemAvailable:"), kb_field(meminfo, "SwapFree:"))
}

fn size(kb: u64) -> String {
    match kb {
        kb if kb >= 1024 * 1024 => format!("{:.1}G", kb as f64 / (1024.0 * 1024.0)),
        kb => format!("{}M", kb / 1024),
    }
}

fn usage_line(
    processes: &[Process],
    previous: &HashMap<u32, u64>,
    elapsed_ticks: f64,
    available_kb: u64,
    swap_free_kb: u64,
) -> String {
    // A pid missing from the previous sample was born since, so all its ticks fall in the interval.
    let cpu = |p: &Process| {
        let spent = p.ticks.saturating_sub(previous.get(&p.pid).copied().unwrap_or(0));
        if elapsed_ticks > 0.0 { (spent as f64 / elapsed_ticks * 100.0).round() as u64 } else { 0 }
    };
    let rss: u64 = processes.iter().map(|p| p.rss_kb).sum();
    let swap: u64 = processes.iter().map(|p| p.swap_kb).sum();
    let total_cpu: u64 = processes.iter().map(cpu).sum();
    let mut heaviest: Vec<&Process> = processes.iter().collect();
    heaviest.sort_by_key(|p| std::cmp::Reverse(p.rss_kb + p.swap_kb));
    let top: Vec<String> = heaviest
        .into_iter()
        .take(TOP)
        .map(|p| {
            let swapped = if p.swap_kb > 0 { format!("+{} swap", size(p.swap_kb)) } else { String::new() };
            format!("{}[{}] {}{} {}%", p.name, p.pid, size(p.rss_kb), swapped, cpu(p))
        })
        .collect();
    format!(
        "usage {} processes, {} ram + {} swap, cpu {}% | system {} available, {} swap free | {}",
        processes.len(),
        size(rss),
        size(swap),
        total_cpu,
        size(available_kb),
        size(swap_free_kb),
        top.join(", "),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn process(pid: u32, ppid: u32, name: &str, ticks: u64, rss_kb: u64, swap_kb: u64) -> Process {
        Process { pid, ppid, name: name.into(), ticks, rss_kb, swap_kb }
    }

    #[test]
    fn parse_stat_reads_a_name_with_spaces_and_parentheses() {
        let stat = "4242 (Web Content (x)) S 1000 4242 4242 0 -1 4194560 100 0 0 0 250 50 0 0 20 0 30 0 123";
        assert_eq!(parse_stat(stat), Some(("Web Content (x)".to_string(), 1000, 300)));
        assert_eq!(parse_stat("garbage"), None);
    }

    #[test]
    fn parse_status_and_meminfo_read_kb_fields() {
        let status = "Name:\tcairn\nVmRSS:\t  524288 kB\nVmSwap:\t    2048 kB\n";
        assert_eq!(parse_status(status), (524_288, 2048));
        assert_eq!(parse_status("Name:\tkthreadd\n"), (0, 0));
        let meminfo = "MemTotal: 20000000 kB\nMemAvailable:  3363840 kB\nSwapFree:   220160 kB\n";
        assert_eq!(parse_meminfo(meminfo), (3_363_840, 220_160));
    }

    #[test]
    fn descendants_follow_the_whole_subtree_only() {
        let all = vec![
            process(1, 0, "init", 0, 0, 0),
            process(10, 1, "cairn", 0, 0, 0),
            process(11, 10, "WebKitWebProcess", 0, 0, 0),
            process(12, 10, "zsh", 0, 0, 0),
            process(13, 12, "claude", 0, 0, 0),
            process(20, 1, "other", 0, 0, 0),
        ];
        let pids: Vec<u32> = descendants(10, &all).iter().map(|p| p.pid).collect();
        assert_eq!(pids, vec![10, 11, 12, 13]);
    }

    #[test]
    fn usage_line_sums_the_tree_and_lists_the_heaviest_first() {
        let processes = vec![
            process(10, 1, "cairn", 1100, 400 * 1024, 0),
            process(11, 10, "WebKitWebProces", 5000, 3 * 1024 * 1024, 1024 * 1024),
            process(13, 12, "claude", 300, 200 * 1024, 0),
        ];
        let previous = HashMap::from([(10, 1000), (11, 2000)]);
        let line = usage_line(&processes, &previous, 6000.0, 3_363_840, 220_160);
        assert_eq!(
            line,
            "usage 3 processes, 3.6G ram + 1.0G swap, cpu 57% | system 3.2G available, 215M swap free | \
             WebKitWebProces[11] 3.0G+1.0G swap 50%, cairn[10] 400M 2%, claude[13] 200M 5%"
        );
    }
}
