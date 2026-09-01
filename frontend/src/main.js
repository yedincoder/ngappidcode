import { 
    OpenFile, SaveFile, OpenFolderDialog, ReadFileByPath, 
    GitPull, GitCommitAndPush, GetFolderContents,
    CreateNewFile, CreateNewFolder, RenameItem, DeleteItem, GitInit, RunCommand,
    SetGitConfig, AddGitRemote, GitReset, GetAppVersion
} from '../wailsjs/go/main/App';

GetAppVersion().then(version => {
    window.APP_VERSION = version;
    document.getElementById('app-version-display').innerText = `NgAppID Code Editor ${version}`;
});

let editorInstance;
let tabs = [];
let activeFilePath = null;
let currentFolderPath = localStorage.getItem('lastFolder') || ""; 

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
	renderTabs();
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
        if (welcomeScreen) {
            welcomeScreen.classList.remove('hidden');
            // FIX: Paksa Welcome Screen tampil di atas layer Monaco Editor
            welcomeScreen.style.zIndex = '50';
            welcomeScreen.style.backgroundColor = '#1e1e1e';
        }
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
        <div class="flex items-center gap-2 truncate flex-1 min-w-0">
            <span class="w-4 flex justify-center items-center shrink-0">${getFileIcon(itemName, isDir)}</span> 
            <span class="name-display truncate flex-1">${itemName}</span>
        </div>
        <div class="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button class="btn-rename text-blue-400 hover:text-white px-1">✎</button>
            <button class="btn-del text-red-400 hover:text-white px-1">🗑</button>
        </div>
    `;
    wrapper.appendChild(div);

    const nameDisplay = div.querySelector('.name-display');

    div.querySelector('.btn-rename').addEventListener('click', (e) => {
        e.stopPropagation();
        
        if (div.querySelector('.rename-input')) return; 

        const input = document.createElement('input');
        input.type = 'text';
        input.value = itemName;
        input.className = 'rename-input bg-[#1e1e1e] text-white px-1 border border-blue-500 rounded text-xs w-full outline-none focus:ring-1 focus:ring-blue-500';

        nameDisplay.style.display = 'none';
        nameDisplay.parentNode.insertBefore(input, nameDisplay.nextSibling);

        input.focus();
        const dotIndex = itemName.lastIndexOf('.');
        if (!isDir && dotIndex > 0) {
            input.setSelectionRange(0, dotIndex); 
        } else {
            input.select(); 
        }

        let isProcessing = false;

        const finishRename = async (save) => {
            if (isProcessing) return;
            isProcessing = true;

            const newName = input.value.trim();
            input.remove();
            nameDisplay.style.display = '';

            if (save && newName && newName !== itemName) {
                try {
                    const newPath = itemPath.substring(0, itemPath.lastIndexOf(itemName)) + newName;
                    await RenameItem(itemPath, newPath);
                    
                    if (activeFilePath === itemPath) {
                        activeFilePath = newPath;
                        const tab = tabs.find(t => t.path === itemPath);
                        if (tab) {
                            tab.path = newPath;
                            tab.name = newName;
                            renderTabs();
                            document.getElementById('file-path').innerText = newPath;
                        }
                    }
                    refreshSidebar(); 
                } catch (err) { 
                    logToTerminal("System", "Gagal mengganti nama: " + String(err), true); 
                }
            }
        };

        input.addEventListener('blur', () => finishRename(true));
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') finishRename(true);
            if (e.key === 'Escape') finishRename(false);
            e.stopPropagation(); 
        });
        input.addEventListener('click', (e) => e.stopPropagation());
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
            if (e.target.tagName === 'INPUT') return; // FIX: Cegah folder buka/tutup saat input rename di klik

            if (subContainer.classList.contains('hidden')) {
                await openFolder();
            } else { 
                closeFolder(); 
            }
        });

        if (expandedFolders.has(itemPath)) {
            openFolder();
        }
    } else {
        div.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (e.target.tagName === 'INPUT') return; // FIX: Cegah file terbuka saat input rename di klik
            
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
        expandedFolders.clear(); 
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
        const cmdLower = cmd.toLowerCase();
        
        if (terminalState === 'NORMAL') {
            if (!cmd) return;
            termInput.value = '';
            
            // --- CUSTOM COMMANDS (NgAppID Built-in) ---
            if (cmdLower === 'clear' || cmdLower === 'cls') {
                termOutput.innerHTML = '';
                return;
            }
            
            termOutput.innerHTML += `\n<span class="text-green-400">❯ ${cmd}</span>\n`;
            
            if (cmdLower === 'help') {
                termOutput.innerHTML += `<span class="text-blue-300 font-bold">Perintah bawaan NgAppID Editor:</span>\n`;
                termOutput.innerHTML += `<span class="text-green-300">help</span>      <span class="text-gray-400">- Menampilkan menu bantuan ini</span>\n`;
                termOutput.innerHTML += `<span class="text-green-300">about</span>     <span class="text-gray-400">- Informasi tentang aplikasi dan developer</span>\n`;
                termOutput.innerHTML += `<span class="text-green-300">clear</span>     <span class="text-gray-400">- Membersihkan layar terminal</span>\n`;
                termOutput.innerHTML += `<span class="text-green-300">version</span>   <span class="text-gray-400">- Menampilkan versi aplikasi saat ini</span>\n`;
                termOutput.innerHTML += `<span class="text-red-400">ungit</span>       <span class="text-gray-400">- Menghapus konfigurasi Git (.git) dari project</span>\n`;
                termOutput.innerHTML += `<span class="text-gray-500">----------------------------------------------------</span>\n`;
                termOutput.innerHTML += `<span class="text-gray-400">💡 Kamu juga bisa menjalankan perintah OS bawaan (npm, git, go, dir, ls, dll).</span>\n`;
                termOutput.scrollTop = termOutput.scrollHeight;
                return;
            }
            else if (cmdLower === 'about' || cmdLower === 'developer') {
                termOutput.innerHTML += `<span class="text-blue-400 font-bold">🚀 NgAppID Code Editor ${window.APP_VERSION || ''}</span>\n`;
                termOutput.innerHTML += `<span class="text-gray-300">Sebuah karya untuk kemudahan developer di seluruh Nusantara.</span>\n\n`;
                termOutput.innerHTML += `<span class="text-yellow-400 font-bold">👨‍💻 Developer Info:</span>\n`;
                termOutput.innerHTML += `<span class="text-gray-300">Author  : Yedi Nurwali (YedinCoder)</span>\n`;
                termOutput.innerHTML += `<span class="text-gray-300">Team    : NgAppID</span>\n`;
                termOutput.innerHTML += `<span class="text-gray-300">Company : PT. YEDIN DIGITAL MANDIRI</span>\n`;
                termOutput.innerHTML += `<span class="text-gray-300">Website : <a href="https://yedin.my.id" target="_blank" class="text-blue-400 hover:underline">yedin.my.id</a> | <a href="https://ngappi.com" target="_blank" class="text-blue-400 hover:underline">ngappi.com</a></span>\n`;
                termOutput.innerHTML += `<span class="text-gray-300">Email   : yedincoder@gmail.com</span>\n`;
                termOutput.scrollTop = termOutput.scrollHeight;
                return;
            }
            else if (cmdLower === 'version') {
                termOutput.innerHTML += `<span class="text-cyan-400">NgAppID Code Editor Version: <strong>${window.APP_VERSION || 'Unknown'}</strong></span>\n`;
                termOutput.scrollTop = termOutput.scrollHeight;
                return;
            }
            else if (cmdLower === 'ungit') {
                if (!currentFolderPath) {
                    termOutput.innerHTML += `<span class="text-red-400">Error: Buka folder project dulu!</span>\n`;
                    termOutput.scrollTop = termOutput.scrollHeight;
                    return;
                }
                terminalState = 'AWAITING_UNGIT_CONFIRM';
                termOutput.innerHTML += `<span class="text-red-400 font-bold">⚠️ PERINGATAN: Ini akan menghapus folder .git beserta SEMUA history commit lokal!</span>\n`;
                termOutput.innerHTML += `<span class="text-yellow-400">Yakin ingin melanjutkan? (ketik 'y' untuk Ya, 'n' untuk Batal): </span>`;
                termOutput.scrollTop = termOutput.scrollHeight;
                return;
            }
            // --- END CUSTOM COMMANDS ---

            // Eksekusi OS Command standar jika bukan perintah bawaan
            termInput.disabled = true;
            termInput.placeholder = "⏳ Memproses...";
            
            try { 
                termOutput.innerHTML += await RunCommand(currentFolderPath, cmd); 
            } catch (err) { 
                termOutput.innerHTML += `<span class="text-red-400">${err}</span>`; 
            } finally {
                termOutput.scrollTop = termOutput.scrollHeight;
                refreshSidebar();
                termInput.disabled = false;
                termInput.placeholder = "Ketik perintah di sini (misal: help, npm i, go run main.go)...";
                termInput.focus();
            }
            return;
        }

        // Logic State Machine (Git Config, Reset, Ungit)
        termInput.value = '';
        termOutput.innerHTML += `<span class="text-yellow-400">${cmd}</span>\n`; 

        if (terminalState === 'AWAITING_SETUP_NAME') {
            // ... (kode setup name bawaanmu tetap di sini)
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
            // ... (kode setup email bawaanmu tetap di sini)
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
            // ... (kode setup remote bawaanmu tetap di sini)
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
            // ... (kode reset bawaanmu tetap di sini)
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
        // 👇 TAMBAHKAN LOGIKA UNGIT DI SINI 👇
        else if (terminalState === 'AWAITING_UNGIT_CONFIRM') {
            terminalState = 'NORMAL';
            if (cmd.toLowerCase() === 'y' || cmd.toLowerCase() === 'yes') {
                termOutput.innerHTML += `<span class="text-yellow-400">Menghapus folder .git...</span>\n`;
                termInput.disabled = true;
                try {
                    // Deteksi separator folder sesuai OS (Windows pakai \ , Mac/Linux pakai /)
                    const separator = currentFolderPath.includes('\\') ? '\\' : '/';
                    const gitPath = currentFolderPath + separator + '.git';
                    
                    // Gunakan fungsi hapus bawaan backend Wails (super aman & cross-platform)
                    await DeleteItem(gitPath);
                    logToTerminal("ungit", "✔ Folder .git berhasil dihapus. Project ini kembali menjadi folder biasa.");
                    refreshSidebar();
                } catch (err) {
                    logToTerminal("ungit", String(err), true);
                } finally {
                    termInput.disabled = false;
                    termInput.focus();
                }
            } else {
                termOutput.innerHTML += `<span class="text-gray-400">✔ Proses ungit dibatalkan.</span>\n`;
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
const btnGitUngit = document.getElementById('btn-git-ungit');
btnGitUngit.addEventListener('click', () => {
    document.getElementById('git-dropdown').classList.add('hidden'); 
    
    if (!currentFolderPath) return logToTerminal("Git", "Buka folder project dulu sebelum menghapus Git!", true);
    
    const panel = document.getElementById('terminal-panel');
    panel.classList.remove('hidden'); 
    
    terminalState = 'AWAITING_UNGIT_CONFIRM';
    
    termOutput.innerHTML += `\n<span class="text-red-400 font-bold">⚠️ PERINGATAN: Ini akan menghapus folder .git beserta SEMUA history commit lokal!</span>\n`;
    termOutput.innerHTML += `<span class="text-yellow-400">Yakin ingin melanjutkan? (ketik 'y' untuk Ya, 'n' untuk Batal): </span>`;
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

// --- LOGIKA CLOSE PROJECT ---
document.getElementById('btn-close-project').addEventListener('click', (e) => {
    e.stopPropagation();
    
    // Hapus data dari memori dan cache browser
    currentFolderPath = "";
    localStorage.removeItem('lastFolder');
    expandedFolders.clear();
    
    // Hancurkan semua model (tab) yang terbuka di memori Monaco Editor
    tabs.forEach(t => t.model.dispose());
    tabs = [];
    activeFilePath = null;
    if (editorInstance) editorInstance.setModel(null);
    
    // Tutup UI Sidebar, Resizer, dan Terminal
    document.getElementById('sidebar').classList.add('hidden');
    document.getElementById('resizer').classList.add('hidden');
    document.getElementById('terminal-panel').classList.add('hidden');
    document.getElementById('file-list').innerHTML = '';
    
    // Render ulang UI (ini akan otomatis memunculkan kembali Welcome Screen)
    renderTabs();
});

// --- RECENT HISTORY MANAGER ---
function getRecentProjects() {
    try {
        return JSON.parse(localStorage.getItem('ngappid_recent') || '[]');
    } catch {
        return [];
    }
}

function addRecentProject(folderPath) {
    if (!folderPath) return;
    let list = getRecentProjects();
    // Hapus jika sudah ada agar naik ke urutan paling atas
    list = list.filter(p => p !== folderPath);
    list.unshift(folderPath); // Masukkan ke urutan pertama
    if (list.length > 10) list.pop(); // Batasi maksimal 10 riwayat
    localStorage.setItem('ngappid_recent', JSON.stringify(list));
    renderRecentHistory();
}

function renderRecentHistory() {
    const container = document.getElementById('recent-history-container');
    if (!container) return;
    
    const list = getRecentProjects();
    if (list.length === 0) {
        container.innerHTML = `<p class="text-xs text-gray-500 italic py-2 text-center">Belum ada riwayat project tersimpan.</p>`;
        return;
    }

    container.innerHTML = '';
    list.forEach(path => {
        const folderName = path.split(/[/\\]/).pop();
        const itemEl = document.createElement('div');
        itemEl.className = "flex items-center justify-between p-2.5 bg-[#2d2d2d]/60 hover:bg-[#37373d] border border-[#444]/30 rounded-lg text-xs cursor-pointer transition group";
        itemEl.innerHTML = `
            <div class="flex items-center gap-2.5 truncate flex-1 mr-2">
                <span class="text-base">📂</span>
                <div class="truncate">
                    <div class="font-medium text-gray-200 group-hover:text-blue-300 truncate">${folderName}</div>
                    <div class="text-[10px] text-gray-500 truncate">${path}</div>
                </div>
            </div>
            <span class="text-[10px] text-gray-500 group-hover:text-gray-300 bg-[#1e1e1e] px-2 py-1 rounded border border-[#444]">Buka</span>
        `;
        itemEl.onclick = () => loadFolderData(path);
        container.appendChild(itemEl);
    });
}

// Panggil fungsi render riwayat saat pertama kali script dimuat
document.addEventListener("DOMContentLoaded", () => {
    renderRecentHistory();
});

// Event listener untuk tombol interaktif di dalam Welcome Screen
document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'w-btn-clear-history') {
        localStorage.removeItem('ngappid_recent');
        renderRecentHistory();
    }
});

document.getElementById('w-btn-open-folder').addEventListener('click', async () => {
    const result = await OpenFolderDialog();
    if (result && result.base_path) {
        addRecentProject(result.base_path);
        loadFolderData(result.base_path);
    }
});

document.getElementById('w-btn-open-file').addEventListener('click', async () => {
    const fileInfo = await OpenFile();
    if (fileInfo && fileInfo.path) openTab(fileInfo.path, fileInfo.content);
});

// Jangan lupa update juga fungsi loadFolderData agar otomatis mencatat riwayat
const originalLoadFolderData = loadFolderData;
window.loadFolderData = async function(basePath) {
    addRecentProject(basePath);
    return originalLoadFolderData(basePath);
};

