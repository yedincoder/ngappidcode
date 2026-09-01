package main

import (
	"context"
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
	GitState string `json:"git_state"` // Kosong, "M" (Modified), "U" (Untracked)
}

type FolderInfo struct {
	BasePath string     `json:"base_path"`
	Files    []FileItem `json:"files"`
}

func NewApp() *App { return &App{} }
func (a *App) startup(ctx context.Context) { a.ctx = ctx }

// --- FILE MANAGEMENT ---

func (a *App) OpenFile() (FileInfo, error) {
	filepath, err := wailsRuntime.OpenFileDialog(a.ctx, wailsRuntime.OpenDialogOptions{Title: "Buka File Kode"})
	if err != nil || filepath == "" {
		return FileInfo{}, err
	}
	content, err := os.ReadFile(filepath)
	if err != nil {
		return FileInfo{}, err
	}
	return FileInfo{Path: filepath, Content: string(content)}, nil
}

func (a *App) SaveFile(currentPath string, content string) (string, error) {
	filepath := currentPath
	if filepath == "" {
		selectedPath, err := wailsRuntime.SaveFileDialog(a.ctx, wailsRuntime.SaveDialogOptions{Title: "Simpan File Kode"})
		if err != nil || selectedPath == "" {
			return "", err
		}
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
	if err != nil {
		return err
	}
	return file.Close()
}

func (a *App) CreateNewFolder(path string) error {
	return os.MkdirAll(path, 0755)
}

func (a *App) RenameItem(oldPath string, newPath string) error {
	return os.Rename(oldPath, newPath)
}

func (a *App) DeleteItem(path string) error {
	return os.RemoveAll(path)
}

// --- FOLDER & EXPLORER ---

func (a *App) OpenFolderDialog() (FolderInfo, error) {
	folderPath, err := wailsRuntime.OpenDirectoryDialog(a.ctx, wailsRuntime.OpenDialogOptions{Title: "Buka Folder Project"})
	if err != nil || folderPath == "" {
		return FolderInfo{}, err
	}

	files, err := a.GetFolderContents(folderPath)
	if err != nil {
		return FolderInfo{}, err
	}

	return FolderInfo{BasePath: folderPath, Files: files}, nil
}

func (a *App) GetFolderContents(folderPath string) ([]FileItem, error) {
	entries, err := os.ReadDir(folderPath)
	if err != nil {
		return nil, err
	}

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

// --- GIT INTEGRATION ---

func (a *App) GitPull(projectPath string) (string, error) {
	if projectPath == "" {
		return "Error: Buka folder project dulu, bro!", nil
	}
	cmd := exec.Command("git", "pull")
	cmd.Dir = projectPath
	out, err := cmd.CombinedOutput()
	if err != nil {
		return string(out), err
	}
	return string(out), nil
}

func (a *App) GitCommitAndPush(projectPath string, message string) (string, error) {
	if projectPath == "" {
		return "Error: Buka folder project dulu!", nil
	}

	cmdAdd := exec.Command("git", "add", ".")
	cmdAdd.Dir = projectPath
	if outAdd, err := cmdAdd.CombinedOutput(); err != nil {
		return "Git Add Error:\n" + string(outAdd), err
	}

	cmdCommit := exec.Command("git", "commit", "-m", message)
	cmdCommit.Dir = projectPath
	outCommit, _ := cmdCommit.CombinedOutput()

	cmdPush := exec.Command("git", "push")
	cmdPush.Dir = projectPath
	outPush, errPush := cmdPush.CombinedOutput()
	if errPush != nil {
		return string(outCommit) + "\n\nGit Push Error:\n" + string(outPush), errPush
	}

	return string(outCommit) + "\n\n" + string(outPush), nil
}

func (a *App) GitInit(projectPath string) (string, error) {
	if projectPath == "" {
		return "Error: Path kosong", nil
	}
	cmd := exec.Command("git", "init")
	cmd.Dir = projectPath
	out, err := cmd.CombinedOutput()
	return string(out), err
}

func (a *App) GetGitStatus(projectPath string) (map[string]string, error) {
	cmd := exec.Command("git", "status", "--porcelain")
	cmd.Dir = projectPath
	out, err := cmd.Output()
	statusMap := make(map[string]string)
	if err != nil {
		return statusMap, err
	}

	lines := strings.Split(string(out), "\n")
	for _, line := range lines {
		if len(line) < 4 {
			continue
		}
		state := strings.TrimSpace(line[:2])
		fileRelative := strings.TrimSpace(line[3:])
		absPath := filepath.Join(projectPath, fileRelative)

		if strings.Contains(state, "M") {
			statusMap[absPath] = "M" 
		}
		if strings.Contains(state, "?") || strings.Contains(state, "A") {
			statusMap[absPath] = "U" 
		}
	}
	return statusMap, nil
}

// --- TERMINAL & UTILS ---

func (a *App) RunCommand(dir string, command string) (string, error) {
	var cmd *exec.Cmd
	if runtime.GOOS == "windows" {
		cmd = exec.Command("cmd", "/c", command)
	} else {
		cmd = exec.Command("sh", "-c", command)
	}
	cmd.Dir = dir
	out, err := cmd.CombinedOutput()
	return string(out), err
}

func (a *App) ShowAlert(title string, message string, msgType string) {
	dialogType := wailsRuntime.InfoDialog
	if msgType == "error" {
		dialogType = wailsRuntime.ErrorDialog
	}
	wailsRuntime.MessageDialog(a.ctx, wailsRuntime.MessageDialogOptions{
		Type:    dialogType,
		Title:   title,
		Message: message,
	})
}