use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::{Arc, Mutex};

/// Holds the state for a Python download subprocess.
///
/// Only one download can be active at a time. This is managed via a
/// Mutex-protected Option<tokio::process::Child> wrapped in an Arc so the
/// shared state can be cloned into spawned tasks.
///
/// The `intentional_stop` flag is set by cancel commands to indicate
/// that the child process was killed on purpose (not a crash).
///
/// `current_pid` stores the OS-level PID of the running download process
/// so that cancel can kill it even if the child handle has been taken by
/// the wait-task.
#[derive(Clone)]
pub struct PythonDownloadState {
    pub child: Arc<Mutex<Option<tokio::process::Child>>>,
    pub intentional_stop: Arc<AtomicBool>,
    pub current_pid: Arc<AtomicU32>,
}

impl PythonDownloadState {
    pub fn new() -> Self {
        Self {
            child: Arc::new(Mutex::new(None)),
            intentional_stop: Arc::new(AtomicBool::new(false)),
            current_pid: Arc::new(AtomicU32::new(0)),
        }
    }

    /// Reset state for a new download cycle.
    pub fn reset(&self) {
        self.intentional_stop.store(false, Ordering::SeqCst);
        self.current_pid.store(0, Ordering::SeqCst);
    }

    /// Check whether the current download was intentionally stopped.
    pub fn was_stopped(&self) -> bool {
        self.intentional_stop.load(Ordering::SeqCst)
    }

    /// Mark the current download as intentionally stopped.
    pub fn mark_stopped(&self) {
        self.intentional_stop.store(true, Ordering::SeqCst);
    }

    /// Store the PID of the current download process.
    pub fn set_pid(&self, pid: u32) {
        self.current_pid.store(pid, Ordering::SeqCst);
    }

    /// Get the PID of the current download process (0 if none).
    pub fn get_pid(&self) -> u32 {
        self.current_pid.load(Ordering::SeqCst)
    }
}

impl Default for PythonDownloadState {
    fn default() -> Self {
        Self::new()
    }
}
