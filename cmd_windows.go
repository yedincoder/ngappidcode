//go:build windows

package main

import (
	"os/exec"
	"syscall"
)

// HiddenCommand menjalankan perintah OS tanpa memunculkan dialog CMD di Windows
func HiddenCommand(name string, arg ...string) *exec.Cmd {
	cmd := exec.Command(name, arg...)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	return cmd
}