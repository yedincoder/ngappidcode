import { 
    OpenFile, SaveFile, OpenFolderDialog, ReadFileByPath, 
    GitPull, GitCommitAndPush, ShowAlert, GetFolderContents,
    CreateNewFile, CreateNewFolder, RenameItem, DeleteItem, GitInit, RunCommand
} from '../wailsjs/go/main/App';

let editorInstance;
let tabs = [];
let activeFilePath = null;
let currentFolderPath = localStorage.getItem('lastFolder') || ""; 

const languageMap = {
    '.js': 'javascript', '.ts': 'typescript', '.go': 'go', '.php': 'php', 
    '.html': 'html', '.css': 'css', '.json': 'json', '.md': 'markdown',
    '.sql': 'sql', '.sh': 'shell', '.xml': 'xml', '.yaml': 'yaml', '.yml': 'yaml'
};

function detectLanguage(filePath) {
    const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
    return languageMap[ext] || 'plaintext';
}

function getFileIcon(fileName, isDir) {
    if (isDir) return '📁';
    
    const ext = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
    const iconMap = {
        '.php': '<i class="devicon-php-plain text-indigo-400 text-base"></i>',
        '.go': '<i class="devicon-go-plain text-cyan-400 text-base"></i>',
        '.js': '<i class="devicon-javascript-plain text-yellow-400 text-base"></i>',
        '.jsx': '<i class="devicon-react-original text-cyan-400 text-base"></i>',
        '.ts': '<i class="devicon-typescript-plain text-blue-500 text-base"></i>',
        '.tsx': '<i class="devicon-react-original text-blue-400 text-base"></i>',
        '.html': '<i class="devicon-html5-plain text-orange-500 text-base"></i>',
        '.css': '<i class="devicon-css3-plain text-blue-400 text-base"></i>',
        '.json': '<i class="devicon-json-plain text-green-400 text-base"></i>',
        '.sql': '<i class="devicon-mysql-plain text-blue-300 text-base"></i>',
        '.md': '<i class="devicon-markdown-original text-gray-300 text-base"></i>'
    };
    
    return iconMap[ext] || '📄';
}

// 1. INIT MONACO EDITOR & AUTOLOAD FOLDER
require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.39.0/min/vs' }});
require(['vs/editor/editor.main'], function() {
    editorInstance = monaco.editor.create(document.getElementById('editor'), {
        theme: 'vs-dark',
        automaticLayout: true,
        fontSize: 14
    });

    editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, async function() {
        saveActiveFile();
    });

    if (currentFolderPath) {
        loadFolderData(currentFolderPath);
    }
});

// 2. UI: SIDEBAR RESIZER
const sidebar = document.getElementById('sidebar');
const resizer = document.getElementById('resizer');
let isResizing = false;

resizer.addEventListener('mousedown', () => isResizing = true);
window.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    document.body.style.cursor = 'col-resize';
    const newWidth = Math.max(150, Math.min(e.clientX, 600));
    sidebar.style.width = `${newWidth}px`;
});
window.addEventListener('mouseup', () => {
    isResizing = false;
    document.body.style.cursor = 'default';
});

// 3. TAB MANAGEMENT & UNSAVED INDICATOR
const tabBar = document.getElementById('tab-bar');
const welcomeScreen = document.getElementById('welcome-screen');

function renderTabs() {
    tabBar.innerHTML = '';
    
    if (tabs.length === 0) {
        tabBar.classList.add('hidden');
        if (welcomeScreen) welcomeScreen.classList.remove('hidden');
        if (editorInstance) editorInstance.setModel(null);
        document.getElementById('file-path').innerText = 'Tidak ada file terbuka';
        return;
    }
    
    tabBar.classList.remove('hidden'); 
    if (welcomeScreen) welcomeScreen.classList.add('hidden');
    
    tabs.forEach(tab => {
        const isActive = tab.path === activeFilePath;
        const tabEl = document.createElement('div');
        
        tabEl.className = `flex items-center gap-2 px-3 py-1.5 cursor-pointer border-r border-[#333] group shrink-0 select-none ${isActive ? 'bg-[#1e1e1e] text-blue-400 border-t-2 border-t-blue-500' : 'bg-[#2d2d2d] text-gray-400 hover:bg-[#252526]'}`;
        tabEl.onclick = () => switchTab(tab.path);
        
        const nameSpan = document.createElement('span');
        nameSpan.innerText = tab.name + (tab.isDirty ? ' •' : '');
        nameSpan.className = `text-xs truncate max-w-[120px] ${tab.isDirty ? 'italic font-bold text-gray-200' : ''}`; 
        
        const closeBtn = document.createElement('span');
        closeBtn.innerText = '×';
        closeBtn.className = `text-base px-1 rounded hover:bg-[#444] ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`;
        closeBtn.onclick = (e) => {
            e.stopPropagation(); 
            closeTab(tab.path);
        };

        tabEl.appendChild(nameSpan);
        tabEl.appendChild(closeBtn);
        tabBar.appendChild(tabEl);
    });
}

function switchTab(filePath) {
    const tab = tabs.find(t => t.path === filePath);
    if (tab && editorInstance) {
        activeFilePath = filePath;
        editorInstance.setModel(tab.model);
        document.getElementById('file-path').innerText = tab.path;
        renderTabs();
    }
}

function openTab(filePath, content) {
    if (typeof monaco === 'undefined' || !editorInstance) return;

    let tab = tabs.find(t => t.path === filePath);
    if (!tab) {
        const fileName = filePath.split('\\').pop().split('/').pop();
        const lang = detectLanguage(filePath);
        const model = monaco.editor.createModel(content, lang);
        
        tab = { path: filePath, name: fileName, model: model, isDirty: false };
        tabs.push(tab);

        model.onDidChangeContent(() => {
            if (!tab.isDirty) {
                tab.isDirty = true;
                renderTabs();
            }
        });
    }
    switchTab(filePath);
}

function closeTab(filePath) {
    const index = tabs.findIndex(t => t.path === filePath);
    if (index !== -1) {
        tabs[index].model.dispose(); 
        tabs.splice(index, 1);
        
        if (activeFilePath === filePath) {
            if (tabs.length > 0) {
                const nextIndex = index > 0 ? index - 1 : 0;
                switchTab(tabs[nextIndex].path);
            } else {
                activeFilePath = null;
                renderTabs();
            }
        } else {
            renderTabs();
        }
    }
}

// 4. FILE MANAGEMENT & SIDEBAR
async function saveActiveFile() {
    if (!activeFilePath || !editorInstance) return;
    try {
        const content = editorInstance.getValue();
        await SaveFile(activeFilePath, content);
        
        const tab = tabs.find(t => t.path === activeFilePath);
        if (tab) {
            tab.isDirty = false;
            renderTabs();
        }

        const btnSave = document.getElementById('btn-save');
        btnSave.classList.add('bg-green-600', 'text-white');
        setTimeout(() => btnSave.classList.remove('bg-green-600', 'text-white'), 300);
        refreshSidebar(); // Refresh untuk update warna git
    } catch (err) { 
        console.error("Gagal simpan:", err); 
    }
}

function createSidebarItem(item, level = 0) {
    const wrapper = document.createElement('div');
    wrapper.className = "flex flex-col w-full";
    
    // Pewarnaan Git Status
    let colorClass = 'text-gray-300';
    if (item.git_state === 'M') colorClass = 'text-yellow-400';
    else if (item.git_state === 'U') colorClass = 'text-green-400';

    const div = document.createElement('div');
    div.className = `py-1 cursor-pointer hover:bg-[#37373d] flex items-center justify-between gap-2 text-sm select-none px-2 group ${colorClass}`;
    
    const icon = getFileIcon(item.name, item.is_dir);
    div.innerHTML = `
        <div class="flex items-center gap-2 truncate">
            <span class="w-4 flex justify-center items-center shrink-0">${icon}</span> 
            <span class="truncate">${item.name}</span>
        </div>
        <div class="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button class="btn-rename text-blue-400 hover:text-white px-1">✎</button>
            <button class="btn-del text-red-400 hover:text-white px-1">🗑</button>
        </div>
    `;
    
    wrapper.appendChild(div);

    // Event Rename
    div.querySelector('.btn-rename').addEventListener('click', async (e) => {
        e.stopPropagation();
        const newName = prompt("Ganti nama menjadi:", item.name);
        if (newName && newName !== item.name) {
            const newPath = item.path.replace(item.name, newName);
            try { 
                await RenameItem(item.path, newPath); 
                refreshSidebar(); 
            } catch (err) { 
                ShowAlert("Error Rename", String(err), "error"); 
            }
        }
    });

    // Event Delete
    div.querySelector('.btn-del').addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm(`Yakin ingin menghapus ${item.name} secara permanen?`)) {
            try { 
                await DeleteItem(item.path); 
                refreshSidebar(); 
                if (activeFilePath === item.path) closeTab(item.path);
            } catch (err) { 
                ShowAlert("Error Hapus", String(err), "error"); 
            }
        }
    });

    if (item.is_dir) {
        const subContainer = document.createElement('div');
        subContainer.className = 'hidden flex-col border-l border-[#444]/40 pl-3 ml-3 my-0.5';
        wrapper.appendChild(subContainer);
        
        let isLoaded = false;
        let isOpen = false;

        div.addEventListener('click', async (e) => {
            e.stopPropagation();
            isOpen = !isOpen;
            
            if (isOpen) {
                if (!isLoaded) {
                    try {
                        const subfiles = await GetFolderContents(item.path);
                        const sortedSubfiles = (subfiles || []).sort((a, b) => b.is_dir - a.is_dir || a.name.localeCompare(b.name));
                        
                        sortedSubfiles.forEach(subItem => {
                            subContainer.appendChild(createSidebarItem(subItem, level + 1));
                        });
                        isLoaded = true;
                    } catch (err) { console.error("Gagal baca subfolder", err); }
                }
                subContainer.classList.remove('hidden');
                div.querySelector('.w-4').innerHTML = '📂'; 
            } else {
                subContainer.classList.add('hidden');
                div.querySelector('.w-4').innerHTML = '📁'; 
            }
        });
    } else {
        div.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (activeFilePath === item.path) return;
            if (tabs.find(t => t.path === item.path)) {
                switchTab(item.path);
            } else {
                try {
                    const content = await ReadFileByPath(item.path);
                    openTab(item.path, content);
                } catch (err) { console.error("Gagal baca file", err); }
            }
        });
    }

    return wrapper;
}

async function loadFolderData(basePath) {
    try {
        currentFolderPath = basePath;
        localStorage.setItem('lastFolder', basePath);
        
        document.getElementById('sidebar').classList.remove('hidden');
        document.getElementById('resizer').classList.remove('hidden');
        document.getElementById('terminal-panel').classList.remove('hidden');
        document.getElementById('folder-name').innerText = basePath.split('\\').pop().split('/').pop();
        
        await refreshSidebar();
    } catch (err) {
        console.error("Gagal meload folder", err);
    }
}

async function refreshSidebar() {
    if (!currentFolderPath) return;
    try {
        const fileListContainer = document.getElementById('file-list');
        fileListContainer.innerHTML = ''; 
        
        const files = await GetFolderContents(currentFolderPath);
        const sortedFiles = (files || []).sort((a, b) => b.is_dir - a.is_dir || a.name.localeCompare(b.name));
        
        sortedFiles.forEach(item => {
            fileListContainer.appendChild(createSidebarItem(item, 0));
        });
    } catch (err) {
        console.error("Gagal refresh sidebar", err);
    }
}

// 5. EVENT LISTENER UTAMA
document.getElementById('btn-open-folder').addEventListener('click', async () => {
    try {
        const result = await OpenFolderDialog();
        if (result && result.base_path) {
            loadFolderData(result.base_path);
        }
    } catch (err) { console.error("Error buka folder:", err); }
});

document.getElementById('btn-open').addEventListener('click', async () => {
    try {
        const fileInfo = await OpenFile();
        if (fileInfo && fileInfo.path) openTab(fileInfo.path, fileInfo.content);
    } catch (err) { console.error(err); }
});

document.getElementById('btn-save').addEventListener('click', saveActiveFile);
document.getElementById('btn-refresh').addEventListener('click', refreshSidebar);

document.getElementById('btn-new-file').addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!currentFolderPath) return ShowAlert("Warning", "Buka folder project dulu, bro!", "error");
    const name = prompt("Masukkan nama file baru (termasuk ekstensi):");
    if (name) {
        await CreateNewFile(`${currentFolderPath}/${name}`);
        refreshSidebar();
    }
});

document.getElementById('btn-new-folder').addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!currentFolderPath) return ShowAlert("Warning", "Buka folder project dulu, bro!", "error");
    const name = prompt("Masukkan nama folder baru:");
    if (name) {
        await CreateNewFolder(`${currentFolderPath}/${name}`);
        refreshSidebar();
    }
});

window.addEventListener('keydown', (e) => {
    const isCtrl = e.ctrlKey || e.metaKey;
    if (isCtrl && e.key.toLowerCase() === 's') {
        e.preventDefault(); 
        saveActiveFile();
    }
    if (isCtrl && e.key.toLowerCase() === 'w') {
        e.preventDefault(); 
        if (activeFilePath) closeTab(activeFilePath);
    }
});

// 6. TERMINAL
const termOutput = document.getElementById('terminal-output');
const termInput = document.getElementById('terminal-input');
document.getElementById('btn-close-terminal').addEventListener('click', () => {
    document.getElementById('terminal-panel').classList.add('hidden');
});

termInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
        const cmd = termInput.value.trim();
        if (!cmd) return;
        
        termInput.value = '';
        termOutput.innerHTML += `\n<span class="text-green-400">❯ ${cmd}</span>\n`;
        termOutput.scrollTop = termOutput.scrollHeight;
        
        try {
            const out = await RunCommand(currentFolderPath, cmd);
            termOutput.innerHTML += out;
        } catch (err) { 
            termOutput.innerHTML += `<span class="text-red-400">${err}</span>`; 
        }
        termOutput.scrollTop = termOutput.scrollHeight;
        refreshSidebar(); 
    }
});

// 7. GIT INTEGRATION
const btnGitPull = document.getElementById('btn-git-pull');
btnGitPull.addEventListener('click', async () => {
    if (!currentFolderPath) return ShowAlert("Peringatan", "Buka folder project dulu ya!", "error");
    
    const originalText = btnGitPull.innerText;
    btnGitPull.innerText = "⏳ Pulling..."; 
    try {
        const output = await GitPull(currentFolderPath);
        ShowAlert("Git Pull Sukses", output, "info");
        refreshSidebar();
    } catch (err) {
        ShowAlert("Git Pull Gagal", String(err), "error");
    } finally {
        btnGitPull.innerText = originalText;
    }
});

const commitModal = document.getElementById('commit-modal');
const commitInput = document.getElementById('commit-message');
const btnGitPush = document.getElementById('btn-git-push');

btnGitPush.addEventListener('click', () => {
    if (!currentFolderPath) return ShowAlert("Peringatan", "Buka folder project dulu ya!", "error");
    commitModal.classList.remove('hidden');
    commitInput.focus(); 
});

document.getElementById('btn-cancel-commit').addEventListener('click', () => {
    commitModal.classList.add('hidden');
    commitInput.value = ''; 
});

document.getElementById('btn-submit-commit').addEventListener('click', async () => {
    const message = commitInput.value.trim() || "Update files via NgAppID Editor";
    commitModal.classList.add('hidden');
    commitInput.value = '';
    
    const originalText = btnGitPush.innerText;
    btnGitPush.innerText = "⏳ Pushing...";
    try {
        const output = await GitCommitAndPush(currentFolderPath, message);
        ShowAlert("Git Push Sukses", output, "info");
        refreshSidebar();
    } catch (err) {
        ShowAlert("Git Push Gagal", String(err), "error");
    } finally {
        btnGitPush.innerText = originalText;
    }
});

commitInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('btn-submit-commit').click();
});

document.getElementById('btn-git-init').addEventListener('click', async () => {
    if (!currentFolderPath) return ShowAlert("Peringatan", "Buka folder project dulu ya!", "error");
    try { 
        await GitInit(currentFolderPath); 
        ShowAlert("Sukses", "Git Repository berhasil diinisialisasi!", "info"); 
        refreshSidebar(); 
    } catch (err) { 
        ShowAlert("Error", String(err), "error"); 
    }
});

// Dropdown Git Menu
const btnGitMenu = document.getElementById('btn-git-menu');
const gitDropdown = document.getElementById('git-dropdown');

btnGitMenu.addEventListener('click', (e) => {
    e.stopPropagation();
    gitDropdown.classList.toggle('hidden');
});

btnGitPull.addEventListener('click', () => gitDropdown.classList.add('hidden'));
btnGitPush.addEventListener('click', () => gitDropdown.classList.add('hidden'));
document.getElementById('btn-git-init').addEventListener('click', () => gitDropdown.classList.add('hidden'));

window.addEventListener('click', () => {
    if (!gitDropdown.classList.contains('hidden')) {
        gitDropdown.classList.add('hidden');
    }
});

// --- DISABLE RIGHT CLICK (CONTEXT MENU) DI LUAR EDITOR ---
window.addEventListener('contextmenu', (e) => {
    // Cek apakah yang diklik kanan itu BUKAN bagian dari area editor
    if (!e.target.closest('#editor')) {
        e.preventDefault(); // Matikan klik kanan bawaan
    }
});