#!/usr/bin/env python3
"""
pty-proxy.py — zero-dependency PTY allocator for nForma's embedded terminal.

Spawns a command inside a real pseudo-terminal so interactive CLIs (like claude)
see isTTY=true on stdin/stdout/stderr. Proxies data between the parent's piped
stdio and the PTY master fd.

Usage: python3 pty-proxy.py <cols> <rows> <command> [args...]

Works on macOS and Linux without any native Node.js addons.
"""

import pty, os, sys, select, signal, struct, fcntl, termios, errno

def set_winsize(fd, rows, cols):
    """Set the terminal window size on a PTY fd."""
    try:
        winsize = struct.pack('HHHH', rows, cols, 0, 0)
        fcntl.ioctl(fd, termios.TIOCSWINSZ, winsize)
    except Exception:
        pass

def main():
    if len(sys.argv) < 4:
        sys.stderr.write('Usage: pty-proxy.py <cols> <rows> <command> [args...]\n')
        sys.exit(1)

    cols = int(sys.argv[1])
    rows = int(sys.argv[2])
    cmd = sys.argv[3]
    args = sys.argv[3:]  # argv[0] for the child = cmd

    # Create PTY pair
    master_fd, slave_fd = pty.openpty()
    set_winsize(master_fd, rows, cols)

    pid = os.fork()
    if pid == 0:
        # ── Child process ──
        os.close(master_fd)
        os.setsid()

        # Set slave as controlling terminal
        fcntl.ioctl(slave_fd, termios.TIOCSCTTY, 0)

        # Redirect stdio to slave PTY
        os.dup2(slave_fd, 0)
        os.dup2(slave_fd, 1)
        os.dup2(slave_fd, 2)
        if slave_fd > 2:
            os.close(slave_fd)

        os.execvp(cmd, args)
        # If exec fails
        os._exit(127)
    else:
        # ── Parent process ──
        os.close(slave_fd)

        # Forward SIGWINCH to child (nForma sends this on resize)
        def on_winch(signum, frame):
            try:
                os.kill(pid, signal.SIGWINCH)
            except Exception:
                pass
        signal.signal(signal.SIGWINCH, on_winch)

        # Make stdin non-blocking
        stdin_fd = sys.stdin.fileno()
        stdout_fd = sys.stdout.fileno()

        # Set stdin to non-blocking
        old_flags = fcntl.fcntl(stdin_fd, fcntl.F_GETFL)
        fcntl.fcntl(stdin_fd, fcntl.F_SETFL, old_flags | os.O_NONBLOCK)

        # Proxy loop: stdin → master, master → stdout
        try:
            while True:
                try:
                    rfds, _, _ = select.select([stdin_fd, master_fd], [], [], 0.1)
                except select.error:
                    break

                if stdin_fd in rfds:
                    try:
                        data = os.read(stdin_fd, 4096)
                        if not data:
                            # stdin closed — send EOF to child
                            os.close(master_fd)
                            break
                        os.write(master_fd, data)
                    except OSError as e:
                        if e.errno not in (errno.EAGAIN, errno.EWOULDBLOCK):
                            break

                if master_fd in rfds:
                    try:
                        data = os.read(master_fd, 4096)
                        if not data:
                            break
                        os.write(stdout_fd, data)
                        sys.stdout.flush()
                    except OSError as e:
                        if e.errno == errno.EIO:
                            # Child exited — PTY closed
                            break
                        if e.errno not in (errno.EAGAIN, errno.EWOULDBLOCK):
                            break
        except KeyboardInterrupt:
            pass
        finally:
            # Restore stdin flags
            try:
                fcntl.fcntl(stdin_fd, fcntl.F_SETFL, old_flags)
            except Exception:
                pass

        # Wait for child and exit with its status
        try:
            _, status = os.waitpid(pid, 0)
            if os.WIFEXITED(status):
                sys.exit(os.WEXITSTATUS(status))
            sys.exit(1)
        except ChildProcessError:
            sys.exit(0)

if __name__ == '__main__':
    main()
