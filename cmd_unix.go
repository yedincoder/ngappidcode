//go:build !windows

package main

import (
	"os/exec"
)

// HiddenCommand menjalankan perintah OS standar untuk Mac/Linux
func HiddenCommand(name string, arg ...string) *exec.Cmd {
	return exec.Command(name, arg...)
}