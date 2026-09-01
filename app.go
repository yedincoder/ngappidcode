package main

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
	ctx context.Context
}

type FileInfo struct {
	Path    string `json:"path"`
	Content string `json:"content"`
}

type FileItem struct {
	Name     string `json:"name"`
	Path     string `json:"path"`
	IsDir    bool   `json:"is_dir"`
	GitState string `json:"git_state"`
}

type FolderInfo struct {
	BasePath string     `json:"base_path"`
	Files    []FileItem `json:"files"`
}

const AppVersion = "v1.0.0"

func NewApp() *App { return &App{} }
func (a *App) startup(ctx context.Context) { a.ctx = ctx }
func (a *App) GetAppVersion() string { return AppVersion }

// --- FILE MANAGEMENT ---
func (a *App) OpenFile() (FileInfo, error) {
	filepath, err := wailsRuntime.OpenFileDialog(a.ctx, wailsRuntime.OpenDialogOptions{Title: "Buka File Kode"})
	if err != nil || filepath == "" { return FileInfo{}, err }
	content, err := os.ReadFile(filepath)
	if err != nil { return FileInfo{}, err }
	return FileInfo{Path: filepath, Content: string(content)}, nil
}

func (a *App) SaveFile(currentPath string, content string) (string, error) {
	filepath := currentPath
	if filepath == "" {
		selectedPath, err := wailsRuntime.SaveFileDialog(a.ctx, wailsRuntime.SaveDialogOptions{Title: "Simpan File Kode"})
		if err != nil || selectedPath == "" { return "", err }
		filepath = selectedPath
	}
	err := os.WriteFile(filepath, []byte(content), 0644)
	return filepath, err
}

func (a *App) ReadFileByPath(filePath string) (string, error) {
	content, err := os.ReadFile(filePath)
	return string(content), err
}

func (a *App) CreateNewFile(path string) error {
	file, err := os.Create(path)
	if err != nil { return err }
	return file.Close()
}

func (a *App) CreateNewFolder(path string) error { return os.MkdirAll(path, 0755) }
func (a *App) RenameItem(oldPath string, newPath string) error { return os.Rename(oldPath, newPath) }
func (a *App) DeleteItem(path string) error { return os.RemoveAll(path) }

// --- FOLDER & EXPLORER ---
func (a *App) OpenFolderDialog() (FolderInfo, error) {
	folderPath, err := wailsRuntime.OpenDirectoryDialog(a.ctx, wailsRuntime.OpenDialogOptions{Title: "Buka Folder Project"})
	if err != nil || folderPath == "" { return FolderInfo{}, err }
	files, err := a.GetFolderContents(folderPath)
	if err != nil { return FolderInfo{}, err }
	return FolderInfo{BasePath: folderPath, Files: files}, nil
}

func (a *App) GetFolderContents(folderPath string) ([]FileItem, error) {
	entries, err := os.ReadDir(folderPath)
	if err != nil { return nil, err }
	gitStatuses, _ := a.GetGitStatus(folderPath)
	var files []FileItem
	for _, entry := range entries {
		path := filepath.Join(folderPath, entry.Name())
		status := gitStatuses[path]
		files = append(files, FileItem{
			Name:     entry.Name(),
			Path:     path,
			IsDir:    entry.IsDir(),
			GitState: status,
		})
	}
	return files, nil
}

// --- GIT SETUP & CONFIG ---
func (a *App) SetGitConfig(name string, email string) error {
	err := HiddenCommand("git", "config", "--global", "user.name", name).Run()
	if err != nil { return err }
	return HiddenCommand("git", "config", "--global", "user.email", email).Run()
}

func (a *App) AddGitRemote(projectPath string, remoteUrl string) error {
	if projectPath == "" { return nil }
	cmdSet := HiddenCommand("git", "remote", "set-url", "origin", remoteUrl)
	cmdSet.Dir = projectPath
	err := cmdSet.Run()
	if err != nil {
		cmdAdd := HiddenCommand("git", "remote", "add", "origin", remoteUrl)
		cmdAdd.Dir = projectPath
		return cmdAdd.Run()
	}
	return nil
}

func (a *App) GitInit(projectPath string) (string, error) {
	if projectPath == "" { return "Error: Path kosong", nil }
	cmd := HiddenCommand("git", "init")
	cmd.Dir = projectPath
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("Git Init Error:\n%s", string(out))
	}
	return string(out), nil
}

// --- GIT ACTION (PULL, PUSH, RESET) ---
func (a *App) GitPull(projectPath string) (string, error) {
	if projectPath == "" { return "", fmt.Errorf("Error: Buka folder project dulu!") }
	cmd := HiddenCommand("git", "pull", "origin", "main")
	cmd.Dir = projectPath
	out, err := cmd.CombinedOutput()
	if err != nil { return "", fmt.Errorf("Git Pull Error:\n%s", string(out)) }
	return string(out), nil
}

// --- GIT PUSH DENGAN AUTO-COMMIT & AUTO-ADD ---
func (a *App) GitCommitAndPush(projectPath string, message string) (string, error) {
	if projectPath == "" {
		return "", fmt.Errorf("Error: Buka folder project dulu!")
	}

	// Step 1: Auto-Init kalau belum ada
	initCmd := HiddenCommand("git", "init")
	initCmd.Dir = projectPath
	initCmd.Run()

	// Step 2: Otomatis Add semua file yang berubah
	cmdAdd := HiddenCommand("git", "add", ".")
	cmdAdd.Dir = projectPath
	if outAdd, err := cmdAdd.CombinedOutput(); err != nil {
		return "", fmt.Errorf("Git Add Error:\n%s", string(outAdd))
	}

	// Step 3: Otomatis Commit
	if message == "" {
		message = "Update via NgAppID Code Editor"
	}
	cmdCommit := HiddenCommand("git", "commit", "-m", message)
	cmdCommit.Dir = projectPath
	outCommit, _ := cmdCommit.CombinedOutput() 

	// Step 4: Push ke remote origin main
	cmdPush := HiddenCommand("git", "push", "-u", "origin", "main")
	cmdPush.Dir = projectPath
	outPush, errPush := cmdPush.CombinedOutput()
	
	if errPush != nil {
		return "", fmt.Errorf("%s\n\nGit Push Error:\n%s\n\n💡 Tips: Pastikan URL Git Remote (origin) sudah disetup lewat menu Git Setup.", string(outCommit), string(outPush))
	}

	return string(outCommit) + "\n\n" + string(outPush), nil
}

// --- GIT RESET DENGAN AUTO-INITIAL COMMIT ---
func (a *App) GitReset(projectPath string) (string, error) {
	if projectPath == "" {
		return "", fmt.Errorf("Error: Buka folder project dulu!")
	}
	
	// Step 1: Pastikan sudah ada repo git
	initCmd := HiddenCommand("git", "init")
	initCmd.Dir = projectPath
	initCmd.Run() 

	// Step 2: Cek apakah sudah ada commit (HEAD)
	checkHead := HiddenCommand("git", "rev-parse", "HEAD")
	checkHead.Dir = projectPath
	if err := checkHead.Run(); err != nil {
		// Kalau HEAD tidak ada, lakukan initial commit
		addCmd := HiddenCommand("git", "add", ".")
		addCmd.Dir = projectPath
		addCmd.Run()

		commitCmd := HiddenCommand("git", "commit", "--allow-empty", "-m", "Initial commit by NgAppID Code Editor")
		commitCmd.Dir = projectPath
		outCommit, errCommit := commitCmd.CombinedOutput()
		if errCommit != nil {
			return "", fmt.Errorf("Gagal membuat commit awal:\n%s\n💡 Pastikan Git Setup (Nama & Email) sudah diisi.", string(outCommit))
		}
	}

	// Step 3: Jalankan Git Reset
	cmd := HiddenCommand("git", "reset", "--hard", "HEAD")
	cmd.Dir = projectPath
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("Git Reset Error:\n%s", string(out))
	}
	
	return "Berhasil mereset project ke commit terakhir.\n" + string(out), nil
}

func (a *App) GetGitStatus(projectPath string) (map[string]string, error) {
	cmd := HiddenCommand("git", "status", "--porcelain")
	cmd.Dir = projectPath
	out, err := cmd.Output()
	statusMap := make(map[string]string)
	if err != nil { return statusMap, err }

	lines := strings.Split(string(out), "\n")
	for _, line := range lines {
		if len(line) < 4 { continue }
		state := strings.TrimSpace(line[:2])
		fileRelative := strings.TrimSpace(line[3:])
		absPath := filepath.Join(projectPath, fileRelative)
		if strings.Contains(state, "M") { statusMap[absPath] = "M" }
		if strings.Contains(state, "?") || strings.Contains(state, "A") { statusMap[absPath] = "U" }
	}
	return statusMap, nil
}

// --- TERMINAL & UTILS ---
func (a *App) RunCommand(dir string, command string) (string, error) {
	var cmd *exec.Cmd
	if runtime.GOOS == "windows" {
		cmd = HiddenCommand("cmd", "/c", command)
	} else {
		cmd = HiddenCommand("sh", "-c", command)
	}
	cmd.Dir = dir
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("%s", string(out))
	}
	return string(out), nil
}