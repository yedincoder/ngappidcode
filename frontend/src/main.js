import { 
    OpenFile, SaveFile, OpenFolderDialog, ReadFileByPath, 
    GitPull, GitCommitAndPush, GetFolderContents,
    CreateNewFile, CreateNewFolder, RenameItem, DeleteItem, GitInit, RunCommand,
    SetGitConfig, AddGitRemote, GitReset
} from '../wailsjs/go/main/App';

let editorInstance;
let tabs = [];
let activeFilePath = null;
let currentFolderPath = localStorage.getItem('lastFolder') || ""; 

// FIX: Simpan state folder yang sedang di-expand di sidebar
const expandedFolders = new Set();

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

function logToTerminal(command, output, isError = false) {
    const panel = document.getElementById('terminal-panel');
    const termOutput = document.getElementById('terminal-output');
    
    panel.classList.remove('hidden'); 
    
    termOutput.innerHTML += `\n<span class="text-blue-400">❯ ${command}</span>\n`;
    
    if (isError) {
        termOutput.innerHTML += `<span class="text-red-500 font-bold">❌ STATUS: GAGAL / ERROR</span>\n`;
        termOutput.innerHTML += `<span class="text-red-400">${output}</span>\n`;
    } else {
        termOutput.innerHTML += `<span class="text-green-400 font-bold">✔ STATUS: BERHASIL / SUKSES</span>\n`;
        if (output) {
            termOutput.innerHTML += `<span class="text-gray-300">${output}</span>\n`;
        }
    }
    termOutput.scrollTop = termOutput.scrollHeight;
}

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

    if (currentFolderPath) loadFolderData(currentFolderPath);
});

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
        closeBtn.onclick = (e) => { e.stopPropagation(); closeTab(tab.path); };

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
        const fileName = filePath.split(/[/\\]/).pop();
        const lang = detectLanguage(filePath);
        const model = monaco.editor.createModel(content, lang);
        tab = { path: filePath, name: fileName, model: model, isDirty: false };
        tabs.push(tab);

        model.onDidChangeContent(() => {
            if (!tab.isDirty) { tab.isDirty = true; renderTabs(); }
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
            if (tabs.length > 0) switchTab(tabs[index > 0 ? index - 1 : 0].path);
            else { activeFilePath = null; renderTabs(); }
        } else { renderTabs(); }
    }
}

async function saveActiveFile() {
    if (!activeFilePath || !editorInstance) return;
    try {
        await SaveFile(activeFilePath, editorInstance.getValue());
        const tab = tabs.find(t => t.path === activeFilePath);
        if (tab) { tab.isDirty = false; renderTabs(); }
        document.getElementById('btn-save').classList.add('bg-green-600', 'text-white');
        setTimeout(() => document.getElementById('btn-save').classList.remove('bg-green-600', 'text-white'), 300);
        refreshSidebar(); 
    } catch (err) { logToTerminal("System", "Gagal menyimpan file: " + String(err), true); }
}

const sortFilesSafely = (a, b) => {
    const isDirA = (a.is_dir === true || a.IsDir === true || a.isDir === true) ? 1 : 0;
    const isDirB = (b.is_dir === true || b.IsDir === true || b.isDir === true) ? 1 : 0;
    if (isDirA !== isDirB) return isDirB - isDirA;
    const nameA = a.name || a.Name || "";
    const nameB = b.name || b.Name || "";
    return nameA.localeCompare(nameB);
};

function createSidebarItem(item, level = 0) {
    const isDir = item.is_dir === true || item.IsDir === true || item.isDir === true;
    const itemName = item.name || item.Name || "Unknown";
    const itemPath = item.path || item.Path || "";
    const gitState = item.git_state || item.GitState || "";

    const wrapper = document.createElement('div');
    wrapper.className = "flex flex-col w-full";
    
    let colorClass = 'text-gray-300';
    if (gitState === 'M') colorClass = 'text-yellow-400';
    else if (gitState === 'U') colorClass = 'text-green-400';

    const div = document.createElement('div');
    div.className = `py-1 cursor-pointer hover:bg-[#37373d] flex items-center justify-between gap-2 text-sm select-none px-2 group ${colorClass}`;
    
    div.innerHTML = `
        <div class="flex items-center gap-2 truncate">
            <span class="w-4 flex justify-center items-center shrink-0">${getFileIcon(itemName, isDir)}</span> 
            <span class="truncate">${itemName}</span>
        </div>
        <div class="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button class="btn-rename text-blue-400 hover:text-white px-1">✎</button>
            <button class="btn-del text-red-400 hover:text-white px-1">🗑</button>
        </div>
    `;
    wrapper.appendChild(div);

    div.querySelector('.btn-rename').addEventListener('click', async (e) => {
        e.stopPropagation();
        const newName = prompt("Ganti nama menjadi:", itemName);
        if (newName && newName !== itemName) {
            try { await RenameItem(itemPath, itemPath.replace(itemName, newName)); refreshSidebar(); } 
            catch (err) { logToTerminal("System", "Gagal mengganti nama: " + String(err), true); }
        }
    });

    div.querySelector('.btn-del').addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm(`Yakin ingin menghapus ${itemName} secara permanen?`)) {
            try { 
                await DeleteItem(itemPath); refreshSidebar(); 
                if (activeFilePath === itemPath) closeTab(itemPath);
            } catch (err) { logToTerminal("System", "Gagal menghapus file: " + String(err), true); }
        }
    });

    // FIX UX: Pertahankan status toggle folder berdasarkan `expandedFolders` Set
    if (isDir) {
        const subContainer = document.createElement('div');
        subContainer.className = 'hidden flex-col border-l border-[#444]/40 pl-3 ml-3 my-0.5';
        wrapper.appendChild(subContainer);
        let isLoaded = false;
        
        const openFolder = async () => {
            if (!isLoaded) {
                const subfiles = await GetFolderContents(itemPath);
                (subfiles || []).sort(sortFilesSafely).forEach(s => subContainer.appendChild(createSidebarItem(s, level + 1)));
                isLoaded = true;
            }
            subContainer.classList.remove('hidden'); 
            div.querySelector('.w-4').innerHTML = '📂';
            expandedFolders.add(itemPath);
        };

        const closeFolder = () => {
            subContainer.classList.add('hidden'); 
            div.querySelector('.w-4').innerHTML = '📁';
            expandedFolders.delete(itemPath);
        };
        
        div.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (subContainer.classList.contains('hidden')) {
                await openFolder();
            } else { 
                closeFolder(); 
            }
        });

        // Buka otomatis jika folder ini sebelumnya di-expand
        if (expandedFolders.has(itemPath)) {
            openFolder();
        }
    } else {
        div.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (activeFilePath === itemPath) return;
            try { openTab(itemPath, await ReadFileByPath(itemPath)); } 
            catch (err) { logToTerminal("System", "Gagal membuka file: " + String(err), true); }
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
        document.getElementById('folder-name').innerText = basePath.split(/[/\\]/).pop();
        expandedFolders.clear(); // Bersihkan memori path saat ganti base folder
        await refreshSidebar();
    } catch (err) { logToTerminal("System", "Gagal meload folder.", true); }
}

async function refreshSidebar() {
    if (!currentFolderPath) return;
    try {
        const list = document.getElementById('file-list');
        list.innerHTML = ''; 
        const files = await GetFolderContents(currentFolderPath);
        (files || []).sort(sortFilesSafely).forEach(item => list.appendChild(createSidebarItem(item, 0)));
    } catch (err) { logToTerminal("System", "Gagal refresh sidebar: " + String(err), true); }
}

document.getElementById('btn-open-folder').addEventListener('click', async () => {
    const result = await OpenFolderDialog();
    if (result && result.base_path) loadFolderData(result.base_path);
});
document.getElementById('btn-open').addEventListener('click', async () => {
    const fileInfo = await OpenFile();
    if (fileInfo && fileInfo.path) openTab(fileInfo.path, fileInfo.content);
});
document.getElementById('btn-save').addEventListener('click', saveActiveFile);
document.getElementById('btn-refresh').addEventListener('click', refreshSidebar);

document.getElementById('btn-new-file').addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!currentFolderPath) return logToTerminal("System", "Buka folder project dulu untuk buat file!", true);
    const name = prompt("Nama file baru:");
    if (name) { await CreateNewFile(`${currentFolderPath}/${name}`); refreshSidebar(); }
});
document.getElementById('btn-new-folder').addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!currentFolderPath) return logToTerminal("System", "Buka folder project dulu untuk buat folder!", true);
    const name = prompt("Nama folder baru:");
    if (name) { await CreateNewFolder(`${currentFolderPath}/${name}`); refreshSidebar(); }
});

window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); saveActiveFile(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'w') { e.preventDefault(); if (activeFilePath) closeTab(activeFilePath); }
});

const termOutput = document.getElementById('terminal-output');
const termInput = document.getElementById('terminal-input');
document.getElementById('btn-close-terminal').addEventListener('click', () => document.getElementById('terminal-panel').classList.add('hidden'));

let terminalState = 'NORMAL'; 
let setupData = { name: '', email: '', remote: '' };

// FIX: Set status busy untuk input saat proses background berjalan
termInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
        if (termInput.disabled) return; 

        const cmd = termInput.value.trim();
        
        if (terminalState === 'NORMAL') {
            if (!cmd) return;
            termInput.value = '';
            termInput.disabled = true;
            termInput.placeholder = "⏳ Memproses...";
            termOutput.innerHTML += `\n<span class="text-green-400">❯ ${cmd}</span>\n`;
            
            try { 
                termOutput.innerHTML += await RunCommand(currentFolderPath, cmd); 
            } catch (err) { 
                termOutput.innerHTML += `<span class="text-red-400">${err}</span>`; 
            } finally {
                termOutput.scrollTop = termOutput.scrollHeight;
                refreshSidebar();
                termInput.disabled = false;
                termInput.placeholder = "Ketik perintah di sini (misal: npm i, go run main.go)...";
                termInput.focus();
            }
            return;
        }

        // Logic State Machine (Git Config / Reset)
        termInput.value = '';
        termOutput.innerHTML += `<span class="text-yellow-400">${cmd}</span>\n`; 

        if (terminalState === 'AWAITING_SETUP_NAME') {
            if (!cmd) {
                termOutput.innerHTML += `<span class="text-red-400">✖ Nama tidak boleh kosong. Setup dibatalkan.</span>\n`;
                terminalState = 'NORMAL';
            } else {
                setupData.name = cmd;
                terminalState = 'AWAITING_SETUP_EMAIL';
                termOutput.innerHTML += `<span class="text-blue-400">[Git Setup] 2. Masukkan Email (contoh: me@yedin.my.id): </span>`;
            }
        } 
        else if (terminalState === 'AWAITING_SETUP_EMAIL') {
            if (!cmd) {
                termOutput.innerHTML += `<span class="text-red-400">✖ Email tidak boleh kosong. Setup dibatalkan.</span>\n`;
                terminalState = 'NORMAL';
            } else {
                setupData.email = cmd;
                terminalState = 'AWAITING_SETUP_REMOTE';
                termOutput.innerHTML += `<span class="text-blue-400">[Git Setup] 3. Masukkan URL GitHub Repo (Kosongkan/Enter jika tidak ada): </span>`;
            }
        }
        else if (terminalState === 'AWAITING_SETUP_REMOTE') {
            setupData.remote = cmd;
            terminalState = 'NORMAL'; 
            termOutput.innerHTML += `<span class="text-gray-300">Memproses Git Setup...</span>\n`;
            
            termInput.disabled = true;
            try {
                await SetGitConfig(setupData.name, setupData.email);
                logToTerminal("System", "✔ Git User Config berhasil disetup.");
                
                if (setupData.remote && currentFolderPath) {
                    await AddGitRemote(currentFolderPath, setupData.remote);
                    logToTerminal("System", `✔ Remote origin disetup ke ${setupData.remote}`);
                    await RunCommand(currentFolderPath, "git branch -M main");
                }
                logToTerminal("Git Setup", "Setup Selesai dan Berhasil Disimpan! 🎉");
            } catch (err) {
                logToTerminal("Git Setup Error", String(err), true);
            } finally {
                termInput.disabled = false;
                termInput.focus();
            }
        }
        else if (terminalState === 'AWAITING_RESET_CONFIRM') {
            terminalState = 'NORMAL';
            if (cmd.toLowerCase() === 'y' || cmd.toLowerCase() === 'yes') {
                termOutput.innerHTML += `<span class="text-yellow-400">Memproses Git Reset --hard HEAD...</span>\n`;
                termInput.disabled = true;
                try {
                    const output = await GitReset(currentFolderPath);
                    logToTerminal("git reset --hard HEAD", output);
                    refreshSidebar();
                } catch (err) {
                    logToTerminal("git reset --hard HEAD", String(err), true);
                } finally {
                    termInput.disabled = false;
                    termInput.focus();
                }
            } else {
                termOutput.innerHTML += `<span class="text-gray-400">✔ Git Reset dibatalkan.</span>\n`;
            }
        }
        termOutput.scrollTop = termOutput.scrollHeight;
    }
});

const btnGitPull = document.getElementById('btn-git-pull');
btnGitPull.addEventListener('click', async () => {
    if (!currentFolderPath) return logToTerminal("Git", "Buka folder project dulu sebelum pull!", true);
    const originalText = btnGitPull.innerText;
    btnGitPull.innerText = "⏳ Pulling..."; 
    try {
        const output = await GitPull(currentFolderPath);
        logToTerminal("git pull origin main", output);
        refreshSidebar();
    } catch (err) {
        logToTerminal("git pull origin main", String(err), true);
    } finally { btnGitPull.innerText = originalText; }
});

const commitModal = document.getElementById('commit-modal');
const commitInput = document.getElementById('commit-message');
const btnGitPush = document.getElementById('btn-git-push');

btnGitPush.addEventListener('click', () => {
    if (!currentFolderPath) return logToTerminal("Git", "Buka folder project dulu sebelum push!", true);
    commitModal.classList.remove('hidden'); commitInput.focus(); 
});
document.getElementById('btn-cancel-commit').addEventListener('click', () => { commitModal.classList.add('hidden'); commitInput.value = ''; });

document.getElementById('btn-submit-commit').addEventListener('click', async () => {
    const message = commitInput.value.trim() || "Update files via NgAppID Editor";
    commitModal.classList.add('hidden'); commitInput.value = '';
    const originalText = btnGitPush.innerText;
    btnGitPush.innerText = "⏳ Pushing...";
    try {
        const output = await GitCommitAndPush(currentFolderPath, message);
        logToTerminal(`git commit -m "${message}" && git push -u origin main`, output);
        refreshSidebar();
    } catch (err) {
        logToTerminal("git commit & push", String(err), true);
    } finally { btnGitPush.innerText = originalText; }
});
commitInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') document.getElementById('btn-submit-commit').click(); });

document.getElementById('btn-git-init').addEventListener('click', async () => {
    if (!currentFolderPath) return logToTerminal("Git", "Buka folder project dulu sebelum init repo!", true);
    try { 
        const output = await GitInit(currentFolderPath); 
        logToTerminal("git init", output);
        refreshSidebar(); 
    } catch (err) { 
        logToTerminal("git init", String(err), true);
    }
});

const btnGitReset = document.getElementById('btn-git-reset');
btnGitReset.addEventListener('click', () => {
    if (!currentFolderPath) return logToTerminal("Git", "Buka folder project dulu sebelum reset!", true);
    
    const panel = document.getElementById('terminal-panel');
    panel.classList.remove('hidden'); 
    
    terminalState = 'AWAITING_RESET_CONFIRM';
    
    termOutput.innerHTML += `\n<span class="text-red-400 font-bold">⚠️ PERINGATAN: Git Reset akan menghapus SEMUA perubahan kode yang belum di-commit!</span>\n`;
    termOutput.innerHTML += `<span class="text-yellow-400">Yakin ingin melanjutkan? (ketik 'y' untuk Ya, 'n' untuk Batal): </span>`;
    termOutput.scrollTop = termOutput.scrollHeight;
    termInput.focus();
});

const btnGitSetup = document.getElementById('btn-git-setup');
btnGitSetup.addEventListener('click', () => { 
    document.getElementById('git-dropdown').classList.add('hidden'); 
    
    const panel = document.getElementById('terminal-panel');
    panel.classList.remove('hidden'); 
    
    terminalState = 'AWAITING_SETUP_NAME';
    setupData = { name: '', email: '', remote: '' };
    
    termOutput.innerHTML += `\n<span class="text-blue-400 font-bold">--- MEMULAI GIT SETUP ---</span>\n`;
    termOutput.innerHTML += `<span class="text-blue-400">[Git Setup] 1. Masukkan Nama (contoh: Yedin Coder): </span>`;
    termOutput.scrollTop = termOutput.scrollHeight;
    termInput.focus();
});

const gitDropdown = document.getElementById('git-dropdown');
document.getElementById('btn-git-menu').addEventListener('click', (e) => { e.stopPropagation(); gitDropdown.classList.toggle('hidden'); });
window.addEventListener('click', () => { if (!gitDropdown.classList.contains('hidden')) gitDropdown.classList.add('hidden'); });

document.addEventListener('contextmenu', (e) => {
    const editorArea = document.getElementById('editor');
    const terminalInput = document.getElementById('terminal-input');
    if (!editorArea.contains(e.target) && e.target !== terminalInput) e.preventDefault();
});