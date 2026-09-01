import { 
    OpenFile, SaveFile, OpenFolderDialog, ReadFileByPath, 
    GitPull, GitCommitAndPush, GetFolderContents,
    CreateNewFile, CreateNewFolder, RenameItem, DeleteItem, GitInit, RunCommand,
    SetGitConfig, AddGitRemote, GitReset, GetAppVersion,
    SearchInFiles,
    FTPConnect, FTPReadFile, FTPSaveFile, FTPDisconnect
} from '../wailsjs/go/main/App';

// --- APP VERSION & INITIAL CONFIG ---
GetAppVersion().then(version => {
    window.APP_VERSION = version;
    const versionDisplay = document.getElementById('app-version-display');
    if (versionDisplay) versionDisplay.innerText = `NgAppID Code Editor ${version}`;
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
    
    termOutput.innerHTML += `\n<span class="text-blue-600 dark:text-blue-400">❯ ${command}</span>\n`;
    
    if (isError) {
        termOutput.innerHTML += `<span class="text-red-600 dark:text-red-500 font-bold">❌ STATUS: GAGAL / ERROR</span>\n`;
        termOutput.innerHTML += `<span class="text-red-500 dark:text-red-400">${output}</span>\n`;
    } else {
        termOutput.innerHTML += `<span class="text-green-600 dark:text-green-400 font-bold">✔ STATUS: BERHASIL / SUKSES</span>\n`;
        if (output) {
            termOutput.innerHTML += `<span class="text-gray-800 dark:text-gray-300">${output}</span>\n`;
        }
    }
    termOutput.scrollTop = termOutput.scrollHeight;
}

// --- MONACO EDITOR INITIALIZATION ---
require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.39.0/min/vs' }});
require(['vs/editor/editor.main'], function() {
    const savedConfig = JSON.parse(localStorage.getItem('ngappid_settings')) || { theme: 'vs-dark', fontSize: 14 };

    editorInstance = monaco.editor.create(document.getElementById('editor'), {
        theme: savedConfig.theme,
        automaticLayout: true,
        fontSize: savedConfig.fontSize
    });

    editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, async function() {
        saveActiveFile();
    });
    renderTabs();
    if (currentFolderPath) loadFolderData(currentFolderPath);
});

// --- SIDEBAR RESIZER ---
const sidebar = document.getElementById('sidebar');
const resizer = document.getElementById('resizer');
let isResizing = false;

if (resizer) {
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
}

// --- TAB MANAGEMENT & SAVE ---
const tabBar = document.getElementById('tab-bar');
const welcomeScreen = document.getElementById('welcome-screen');

function renderTabs() {
    tabBar.innerHTML = '';
    if (tabs.length === 0) {
        tabBar.classList.add('hidden');
        if (welcomeScreen) {
            welcomeScreen.classList.remove('hidden');
            welcomeScreen.style.zIndex = '50';
            welcomeScreen.style.backgroundColor = '';
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
        tabEl.className = `flex items-center gap-2 px-3 py-1.5 cursor-pointer border-r border-gray-300 dark:border-[#333] group shrink-0 select-none ${isActive ? 'bg-white dark:bg-[#1e1e1e] text-blue-600 dark:text-blue-400 border-t-2 border-t-blue-500' : 'bg-gray-100 dark:bg-[#2d2d2d] text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-[#252526]'}`;
        tabEl.onclick = () => switchTab(tab.path);
        
        const nameSpan = document.createElement('span');
        nameSpan.innerText = tab.name + (tab.isDirty ? ' •' : '');
        nameSpan.className = `text-xs truncate max-w-[120px] ${tab.isDirty ? 'italic font-bold text-gray-800 dark:text-gray-200' : ''}`; 
        
        const closeBtn = document.createElement('span');
        closeBtn.innerText = '×';
        closeBtn.className = `text-base px-1 rounded hover:bg-gray-300 dark:hover:bg-[#444] ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`;
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

function openTab(filePath, content, isFTP = false) {
    if (typeof monaco === 'undefined' || !editorInstance) return;
    let tab = tabs.find(t => t.path === filePath);
    if (!tab) {
        const fileName = filePath.split(/[/\\]/).pop();
        const lang = detectLanguage(filePath);
        const model = monaco.editor.createModel(content, lang);
        
        // Simpan status isFTP di tab
        tab = { path: filePath, name: fileName, model: model, isDirty: false, isFTP: isFTP };
        tabs.push(tab);

        model.onDidChangeContent(() => {
            if (!tab.isDirty) { tab.isDirty = true; renderTabs(); }
        });
    }
    switchTab(filePath);
}

async function saveActiveFile() {
    if (!activeFilePath || !editorInstance) return;
    try {
        const tab = tabs.find(t => t.path === activeFilePath);
        
        if (tab && tab.isFTP) {
            // JIKA INI FILE FTP: Lakukan Upload ke Server
            const remotePath = activeFilePath.replace('FTP://', ''); // Buang label FTP
            logToTerminal("FTP", `⏳ Menyimpan dan upload ${remotePath} ke server...`);
            const output = await FTPSaveFile(remotePath, editorInstance.getValue());
            logToTerminal("FTP Save", `✔ ${output}`);
        } else {
            // JIKA INI FILE LOKAL BIASA
            await SaveFile(activeFilePath, editorInstance.getValue());
        }

        if (tab) { tab.isDirty = false; renderTabs(); }
        const saveBtn = document.getElementById('btn-save');
        saveBtn.classList.add('bg-green-600', 'text-white');
        setTimeout(() => saveBtn.classList.remove('bg-green-600', 'text-white'), 300);
        refreshSidebar(); 
    } catch (err) { logToTerminal("System", "Gagal menyimpan file: " + String(err), true); }
}
// --- FUNGSI SORTING FILE & FOLDER ---
const sortFilesSafely = (a, b) => {
    const isDirA = (a.is_dir === true || a.IsDir === true || a.isDir === true) ? 1 : 0;
    const isDirB = (b.is_dir === true || b.IsDir === true || b.isDir === true) ? 1 : 0;
    if (isDirA !== isDirB) return isDirB - isDirA; // Folder selalu di atas
    const nameA = a.name || a.Name || "";
    const nameB = b.name || b.Name || "";
    return nameA.localeCompare(nameB); // Sisanya urut abjad
};

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


// --- FILE EXPLORER & SIDEBAR RENDER ---
function createSidebarItem(item, level = 0) {
    const isDir = item.is_dir === true || item.IsDir === true || item.isDir === true;
    const itemName = item.name || item.Name || "Unknown";
    const itemPath = item.path || item.Path || "";
    const gitState = item.git_state || item.GitState || "";

    const wrapper = document.createElement('div');
    wrapper.className = "flex flex-col w-full";
    
    let colorClass = 'text-gray-700 dark:text-gray-300';
    if (gitState === 'M') colorClass = 'text-yellow-600 dark:text-yellow-400';
    else if (gitState === 'U') colorClass = 'text-green-600 dark:text-green-400';

    const div = document.createElement('div');
    div.className = `py-1 cursor-pointer hover:bg-gray-200 dark:hover:bg-[#37373d] flex items-center justify-between gap-2 text-sm select-none px-2 group ${colorClass}`;
    
    // Tampilkan tombol New File/Folder ekstra KHUSUS untuk folder
    let actionButtons = '';
    if (isDir) {
        actionButtons = `
            <button class="btn-new-file text-gray-400 hover:text-black dark:hover:text-white px-0.5" title="New File in Folder">📄<span class="text-[10px]">+</span></button>
            <button class="btn-new-folder text-gray-400 hover:text-black dark:hover:text-white px-0.5" title="New Folder in Folder">📁<span class="text-[10px]">+</span></button>
            <button class="btn-rename text-blue-600 dark:text-blue-400 hover:text-black dark:hover:text-white px-1">✎</button>
            <button class="btn-del text-red-500 dark:text-red-400 hover:text-black dark:hover:text-white px-1">🗑</button>
        `;
    } else {
        actionButtons = `
            <button class="btn-rename text-blue-600 dark:text-blue-400 hover:text-black dark:hover:text-white px-1">✎</button>
            <button class="btn-del text-red-500 dark:text-red-400 hover:text-black dark:hover:text-white px-1">🗑</button>
        `;
    }

    div.innerHTML = `
        <div class="flex items-center gap-2 truncate flex-1 min-w-0">
            <span class="w-4 flex justify-center items-center shrink-0">${getFileIcon(itemName, isDir)}</span> 
            <span class="name-display truncate flex-1">${itemName}</span>
        </div>
        <div class="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            ${actionButtons}
        </div>
    `;
    wrapper.appendChild(div);

    const nameDisplay = div.querySelector('.name-display');

    // LOGIKA RENAME
    div.querySelector('.btn-rename').addEventListener('click', (e) => {
        e.stopPropagation();
        if (div.querySelector('.rename-input')) return; 

        const input = document.createElement('input');
        input.type = 'text';
        input.value = itemName;
        input.className = 'rename-input bg-white dark:bg-[#1e1e1e] text-gray-800 dark:text-white px-1 border border-blue-500 rounded text-xs w-full outline-none focus:ring-1 focus:ring-blue-500';

        nameDisplay.style.display = 'none';
        nameDisplay.parentNode.insertBefore(input, nameDisplay.nextSibling);

        input.focus();
        const dotIndex = itemName.lastIndexOf('.');
        if (!isDir && dotIndex > 0) input.setSelectionRange(0, dotIndex); 
        else input.select(); 

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
                } catch (err) { logToTerminal("System", "Gagal mengganti nama: " + String(err), true); }
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

    // LOGIKA DELETE
    div.querySelector('.btn-del').addEventListener('click', async (e) => {
        e.stopPropagation();
        if (await CustomConfirm(`Yakin ingin menghapus ${itemName} secara permanen?`)) {
            try { 
                await DeleteItem(itemPath); refreshSidebar(); 
                if (activeFilePath === itemPath) closeTab(itemPath);
            } catch (err) { logToTerminal("System", "Gagal menghapus file: " + String(err), true); }
        }
    });

    // LOGIKA FOLDER & SUB-FILE CREATION
    if (isDir) {
        const subContainer = document.createElement('div');
        subContainer.className = 'hidden flex-col border-l border-gray-300 dark:border-[#444]/40 pl-3 ml-3 my-0.5';
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
            if (e.target.tagName === 'INPUT') return;
            if (subContainer.classList.contains('hidden')) await openFolder();
            else closeFolder(); 
        });

        if (expandedFolders.has(itemPath)) openFolder();

        // TAMBAHAN: Event Listener Create File/Folder di dalam sub-folder
        div.querySelector('.btn-new-file').addEventListener('click', async (e) => {
            e.stopPropagation();
            if (subContainer.classList.contains('hidden')) await openFolder();
            showInlineInput(false, itemPath, subContainer);
        });

        div.querySelector('.btn-new-folder').addEventListener('click', async (e) => {
            e.stopPropagation();
            if (subContainer.classList.contains('hidden')) await openFolder();
            showInlineInput(true, itemPath, subContainer);
        });

    } else {
        div.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (e.target.tagName === 'INPUT') return;
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
    list = list.filter(p => p !== folderPath);
    list.unshift(folderPath);
    if (list.length > 10) list.pop();
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
        itemEl.className = "flex items-center justify-between p-2.5 bg-gray-100 dark:bg-[#2d2d2d]/60 hover:bg-gray-200 dark:hover:bg-[#37373d] border border-gray-200 dark:border-[#444]/30 rounded-lg text-xs cursor-pointer transition group";
        itemEl.innerHTML = `
            <div class="flex items-center gap-2.5 truncate flex-1 mr-2">
                <span class="text-base">📂</span>
                <div class="truncate">
                    <div class="font-medium text-gray-800 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-300 truncate">${folderName}</div>
                    <div class="text-[10px] text-gray-500 dark:text-gray-500 truncate">${path}</div>
                </div>
            </div>
            <span class="text-[10px] text-gray-600 dark:text-gray-400 group-hover:text-gray-800 dark:group-hover:text-gray-300 bg-white dark:bg-[#1e1e1e] px-2 py-1 rounded border border-gray-300 dark:border-[#444]">Buka</span>
        `;
        itemEl.onclick = () => loadFolderData(path);
        container.appendChild(itemEl);
    });
}

const originalLoadFolderData = loadFolderData;
window.loadFolderData = async function(basePath) {
    addRecentProject(basePath);
    return originalLoadFolderData(basePath);
};

// --- MAIN TOPBAR BUTTON LISTENERS ---
document.getElementById('btn-open-folder').addEventListener('click', async () => {
    const result = await OpenFolderDialog();
    if (result && result.base_path) {
        addRecentProject(result.base_path);
        loadFolderData(result.base_path);
    }
});
document.getElementById('btn-open').addEventListener('click', async () => {
    const fileInfo = await OpenFile();
    if (fileInfo && fileInfo.path) openTab(fileInfo.path, fileInfo.content);
});
document.getElementById('btn-save').addEventListener('click', saveActiveFile);
document.getElementById('btn-refresh').addEventListener('click', refreshSidebar);

// --- INLINE FILE & FOLDER CREATION ---
// Sekarang menerima targetFolderPath dan appendTarget agar bisa ditanam di sub-folder manapun
function showInlineInput(isDirToCreate, targetFolderPath = currentFolderPath, appendTarget = document.getElementById('file-list')) {
    if (!currentFolderPath) return logToTerminal("System", "Buka folder project dulu!", true);
    
    const existingInput = document.getElementById('inline-create-input');
    if (existingInput) existingInput.closest('.inline-create-wrapper').remove();

    const wrapper = document.createElement('div');
    wrapper.className = "inline-create-wrapper flex flex-col w-full";

    const div = document.createElement('div');
    div.className = `py-1 flex items-center gap-2 text-sm px-2`;

    const icon = isDirToCreate ? '📁' : '📄';

    div.innerHTML = `
        <span class="w-4 flex justify-center items-center shrink-0">${icon}</span>
        <input type="text" id="inline-create-input" class="bg-white dark:bg-[#1e1e1e] text-gray-800 dark:text-white px-1 border border-blue-500 rounded text-xs w-full outline-none focus:ring-1 focus:ring-blue-500" placeholder="Nama ${isDirToCreate ? 'folder' : 'file'} baru...">
    `;
    wrapper.appendChild(div);

    // Tanam inputannya di paling atas dari target container (bisa di root file-list, bisa di dalam sub-folder)
    appendTarget.insertBefore(wrapper, appendTarget.firstChild);

    const input = document.getElementById('inline-create-input');
    input.focus();

    let isProcessing = false;

    const finishCreate = async (save) => {
        if (isProcessing) return;
        isProcessing = true;
        
        const name = input.value.trim();
        wrapper.remove();

        if (save && name) {
            try {
                const separator = targetFolderPath.includes('\\') ? '\\' : '/';
                const fullPath = `${targetFolderPath}${separator}${name}`;
                
                if (isDirToCreate) {
                    await CreateNewFolder(fullPath);
                } else {
                    await CreateNewFile(fullPath);
                }
                
                refreshSidebar();
            } catch (err) {
                logToTerminal("System", `Gagal membuat ${isDirToCreate ? 'folder' : 'file'}: ` + String(err), true);
            }
        }
    };

    input.addEventListener('blur', () => finishCreate(true));
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') finishCreate(true);
        if (e.key === 'Escape') finishCreate(false);
        e.stopPropagation();
    });
    input.addEventListener('click', (e) => e.stopPropagation());
}

// Tombol Root (Di header sidebar explorer atas)
document.getElementById('btn-new-file').addEventListener('click', (e) => {
    e.stopPropagation();
    showInlineInput(false, currentFolderPath, document.getElementById('file-list'));
});

document.getElementById('btn-new-folder').addEventListener('click', (e) => {
    e.stopPropagation();
    showInlineInput(true, currentFolderPath, document.getElementById('file-list'));
});

window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); saveActiveFile(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'w') { e.preventDefault(); if (activeFilePath) closeTab(activeFilePath); }
});

// --- TERMINAL PANEL & INTERACTIVE COMMANDS ---
const termOutput = document.getElementById('terminal-output');
const termInput = document.getElementById('terminal-input');
document.getElementById('btn-close-terminal').addEventListener('click', () => document.getElementById('terminal-panel').classList.add('hidden'));

let terminalState = 'NORMAL'; 
let setupData = { name: '', email: '', remote: '' };

termInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
        if (termInput.disabled) return; 

        const cmd = termInput.value.trim();
        const cmdLower = cmd.toLowerCase();
        
        if (terminalState === 'NORMAL') {
            if (!cmd) return;
            termInput.value = '';
            
            if (cmdLower === 'clear' || cmdLower === 'cls') {
                termOutput.innerHTML = '';
                return;
            }
            
            termOutput.innerHTML += `\n<span class="text-green-700 dark:text-green-400">❯ ${cmd}</span>\n`;
            
            if (cmdLower === 'help') {
                termOutput.innerHTML += `<span class="text-blue-600 dark:text-blue-300 font-bold">Perintah bawaan NgAppID Code Editor:</span>\n`;
                termOutput.innerHTML += `<span class="text-green-700 dark:text-green-300">help</span>      <span class="text-gray-600 dark:text-gray-400">- Menampilkan menu bantuan ini</span>\n`;
                termOutput.innerHTML += `<span class="text-green-700 dark:text-green-300">about</span>     <span class="text-gray-600 dark:text-gray-400">- Informasi tentang aplikasi dan developer</span>\n`;
                termOutput.innerHTML += `<span class="text-green-700 dark:text-green-300">clear</span>     <span class="text-gray-600 dark:text-gray-400">- Membersihkan layar terminal</span>\n`;
                termOutput.innerHTML += `<span class="text-green-700 dark:text-green-300">version</span>   <span class="text-gray-600 dark:text-gray-400">- Menampilkan versi aplikasi saat ini</span>\n`;
                termOutput.innerHTML += `<span class="text-green-700 dark:text-green-300">support / donasi / traktir</span>   <span class="text-gray-600 dark:text-gray-400">- Menampilkan dukungan rekan-rekan</span>\n`;
                termOutput.innerHTML += `<span class="text-gray-400 dark:text-gray-500">----------------------------------------------------</span>\n`;
                termOutput.innerHTML += `<span class="text-gray-600 dark:text-gray-400">💡 Kamu juga bisa menjalankan perintah OS bawaan (npm, git, go, dir, ls, dll).</span>\n`;
                termOutput.scrollTop = termOutput.scrollHeight;
                return;
            }
            else if (cmdLower === 'about' || cmdLower === 'developer') {
                termOutput.innerHTML += `<span class="text-blue-600 dark:text-blue-400 font-bold">🚀 NgAppID Code Editor ${window.APP_VERSION || ''}</span>\n`;
                termOutput.innerHTML += `<span class="text-gray-700 dark:text-gray-300">Sebuah karya untuk kemudahan developer di seluruh Nusantara.</span>\n\n`;
                termOutput.innerHTML += `<span class="text-yellow-600 dark:text-yellow-400 font-bold">👨‍💻 Developer Info:</span>\n`;
                termOutput.innerHTML += `<span class="text-gray-700 dark:text-gray-300">Author  : Yedi Nurwali (YedinCoder)</span>\n`;
                termOutput.innerHTML += `<span class="text-gray-700 dark:text-gray-300">Team    : NgAppID</span>\n`;
                termOutput.innerHTML += `<span class="text-gray-700 dark:text-gray-300">Website : <a href="https://yedin.my.id" target="_blank" class="text-blue-600 dark:text-blue-400 hover:underline">yedin.my.id</a> | <a href="https://dev.ngappid.com" target="_blank" class="text-blue-600 dark:text-blue-400 hover:underline">dev.ngappid.com</a> | <a href="https://ngappid.com" target="_blank" class="text-blue-600 dark:text-blue-400 hover:underline">ngappid.com</a></span>\n`;
                termOutput.innerHTML += `<span class="text-gray-700 dark:text-gray-300">Kontak  : 081802161315</span>\n`;
                termOutput.innerHTML += `<span class="text-gray-700 dark:text-gray-300">Email   : yedincoder@gmail.com</span>\n`;
                termOutput.scrollTop = termOutput.scrollHeight;
                return;
            }
            else if (cmdLower === 'version') {
                termOutput.innerHTML += `<span class="text-cyan-600 dark:text-cyan-400">NgAppID Code Editor Version: <strong>${window.APP_VERSION || 'Unknown'}</strong></span>\n`;
                termOutput.scrollTop = termOutput.scrollHeight;
                return;
            }
            else if (cmdLower === 'ungit') {
                if (!currentFolderPath) {
                    termOutput.innerHTML += `<span class="text-red-600 dark:text-red-400">Error: Buka folder project dulu!</span>\n`;
                    termOutput.scrollTop = termOutput.scrollHeight;
                    return;
                }
                terminalState = 'AWAITING_UNGIT_CONFIRM';
                termOutput.innerHTML += `<span class="text-red-600 dark:text-red-400 font-bold">⚠️ PERINGATAN: Ini akan menghapus folder .git beserta SEMUA history commit lokal!</span>\n`;
                termOutput.innerHTML += `<span class="text-yellow-600 dark:text-yellow-400">Yakin ingin melanjutkan? (ketik 'y' untuk Ya, 'n' untuk Batal): </span>`;
                termOutput.scrollTop = termOutput.scrollHeight;
                return;
            }
            else if (cmdLower === 'support' || cmdLower === 'donasi' || cmdLower === 'traktir') {
                termOutput.innerHTML += `
            <div class="flex flex-row gap-4 my-2 items-start">
                <img src="qris.png" alt="QRIS Donasi" class="w-20 h-20 object-contain rounded border border-gray-300 dark:border-[#444] bg-white p-1">
                <div class="flex flex-col text-gray-700 dark:text-gray-300 text-sm">
                    <span class="text-blue-600 dark:text-blue-400 font-bold">☕ Dukung Pengembangan NgAppID Code Editor</span>
                    <span class="text-gray-700 dark:text-gray-300">Jika aplikasi ini membantu pekerjaanmu, traktir kopi developer-nya yuk!</span>
                    <span class="text-yellow-600 dark:text-yellow-400 font-bold mb-1">💳 Konfirmasi WA: 081802161315</span>
                    <span class="text-green-700 dark:text-green-400 italic">Terima kasih banyak atas dukunganmu! Setiap donasi sangat berarti untuk kelancaran riset dan pengembangan NgAppID selanjutnya. 🙏</span>
                </div>
            </div>\n`;
                setTimeout(() => {
                    termOutput.scrollTop = termOutput.scrollHeight;
                }, 150);
                return; 
            }
            
            termInput.disabled = true;
            termInput.placeholder = "⏳ Memproses...";
            
            try { 
                termOutput.innerHTML += await RunCommand(currentFolderPath, cmd); 
            } catch (err) { 
                termOutput.innerHTML += `<span class="text-red-600 dark:text-red-400">${err}</span>`; 
            } finally {
                termOutput.scrollTop = termOutput.scrollHeight;
                refreshSidebar();
                termInput.disabled = false;
                termInput.placeholder = "Ketik perintah di sini (misal: help, npm i, go run main.go)...";
                termInput.focus();
            }
            return;
        }

        termInput.value = '';
        termOutput.innerHTML += `<span class="text-yellow-600 dark:text-yellow-400">${cmd}</span>\n`; 

        if (terminalState === 'AWAITING_SETUP_NAME') {
            if (!cmd) {
                termOutput.innerHTML += `<span class="text-red-600 dark:text-red-400">✖ Nama tidak boleh kosong. Setup dibatalkan.</span>\n`;
                terminalState = 'NORMAL';
            } else {
                setupData.name = cmd;
                terminalState = 'AWAITING_SETUP_EMAIL';
                termOutput.innerHTML += `<span class="text-blue-600 dark:text-blue-400">[Git Setup] 2. Masukkan Email (contoh: me@yedin.my.id): </span>`;
            }
        } 
        else if (terminalState === 'AWAITING_SETUP_EMAIL') {
            if (!cmd) {
                termOutput.innerHTML += `<span class="text-red-600 dark:text-red-400">✖ Email tidak boleh kosong. Setup dibatalkan.</span>\n`;
                terminalState = 'NORMAL';
            } else {
                setupData.email = cmd;
                terminalState = 'AWAITING_SETUP_REMOTE';
                termOutput.innerHTML += `<span class="text-blue-600 dark:text-blue-400">[Git Setup] 3. Masukkan URL GitHub Repo (Kosongkan/Enter jika tidak ada): </span>`;
            }
        }
        else if (terminalState === 'AWAITING_SETUP_REMOTE') {
            setupData.remote = cmd;
            terminalState = 'NORMAL'; 
            termOutput.innerHTML += `<span class="text-gray-600 dark:text-gray-300">Memproses Git Setup...</span>\n`;
            
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
                termOutput.innerHTML += `<span class="text-yellow-600 dark:text-yellow-400">Memproses Git Reset --hard HEAD...</span>\n`;
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
                termOutput.innerHTML += `<span class="text-gray-600 dark:text-gray-400">✔ Git Reset dibatalkan.</span>\n`;
            }
        }
        else if (terminalState === 'AWAITING_UNGIT_CONFIRM') {
            terminalState = 'NORMAL';
            if (cmd.toLowerCase() === 'y' || cmd.toLowerCase() === 'yes') {
                termOutput.innerHTML += `<span class="text-yellow-600 dark:text-yellow-400">Menghapus folder .git...</span>\n`;
                termInput.disabled = true;
                try {
                    const separator = currentFolderPath.includes('\\') ? '\\' : '/';
                    const gitPath = currentFolderPath + separator + '.git';
                    
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
                termOutput.innerHTML += `<span class="text-gray-600 dark:text-gray-400">✔ Proses ungit dibatalkan.</span>\n`;
            }
        }
        termOutput.scrollTop = termOutput.scrollHeight;
    }
});

// --- GIT MENU ACTION LISTENERS ---
const btnGitPull = document.getElementById('btn-git-pull');
if (btnGitPull) {
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
}

const commitModal = document.getElementById('commit-modal');
const commitInput = document.getElementById('commit-message');
const btnGitPush = document.getElementById('btn-git-push');

if (btnGitPush) {
    btnGitPush.addEventListener('click', () => {
        if (!currentFolderPath) return logToTerminal("Git", "Buka folder project dulu sebelum push!", true);
        commitModal.classList.remove('hidden'); commitInput.focus(); 
    });
}

if (document.getElementById('btn-cancel-commit')) {
    document.getElementById('btn-cancel-commit').addEventListener('click', () => { commitModal.classList.add('hidden'); commitInput.value = ''; });
}

if (document.getElementById('btn-submit-commit')) {
    document.getElementById('btn-submit-commit').addEventListener('click', async () => {
        const message = commitInput.value.trim() || "Update files via NgAppID Code Editor";
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
}

if (commitInput) {
    commitInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') document.getElementById('btn-submit-commit').click(); });
}

if (document.getElementById('btn-git-init')) {
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
}

const btnGitReset = document.getElementById('btn-git-reset');
if (btnGitReset) {
    btnGitReset.addEventListener('click', () => {
        if (!currentFolderPath) return logToTerminal("Git", "Buka folder project dulu sebelum reset!", true);
        
        const panel = document.getElementById('terminal-panel');
        panel.classList.remove('hidden'); 
        
        terminalState = 'AWAITING_RESET_CONFIRM';
        
        termOutput.innerHTML += `\n<span class="text-red-600 dark:text-red-400 font-bold">⚠️ PERINGATAN: Git Reset akan menghapus SEMUA perubahan kode yang belum di-commit!</span>\n`;
        termOutput.innerHTML += `<span class="text-yellow-600 dark:text-yellow-400">Yakin ingin melanjutkan? (ketik 'y' untuk Ya, 'n' untuk Batal): </span>`;
        termOutput.scrollTop = termOutput.scrollHeight;
        termInput.focus();
    });
}

const btnGitSetup = document.getElementById('btn-git-setup');
if (btnGitSetup) {
    btnGitSetup.addEventListener('click', () => { 
        const dropdown = document.getElementById('git-dropdown');
        if (dropdown) dropdown.classList.add('hidden'); 
        
        const panel = document.getElementById('terminal-panel');
        panel.classList.remove('hidden'); 
        
        terminalState = 'AWAITING_SETUP_NAME';
        setupData = { name: '', email: '', remote: '' };
        
        termOutput.innerHTML += `\n<span class="text-blue-600 dark:text-blue-400 font-bold">--- MEMULAI GIT SETUP ---</span>\n`;
        termOutput.innerHTML += `<span class="text-blue-600 dark:text-blue-400">[Git Setup] 1. Masukkan Nama (contoh: Yedin Coder): </span>`;
        termOutput.scrollTop = termOutput.scrollHeight;
        termInput.focus();
    });
}

const btnGitUngit = document.getElementById('btn-git-ungit');
if (btnGitUngit) {
    btnGitUngit.addEventListener('click', () => {
        const dropdown = document.getElementById('git-dropdown');
        if (dropdown) dropdown.classList.add('hidden'); 
        
        if (!currentFolderPath) return logToTerminal("Git", "Buka folder project dulu sebelum menghapus Git!", true);
        
        const panel = document.getElementById('terminal-panel');
        panel.classList.remove('hidden'); 
        
        terminalState = 'AWAITING_UNGIT_CONFIRM';
        
        termOutput.innerHTML += `\n<span class="text-red-600 dark:text-red-400 font-bold">⚠️ PERINGATAN: Ini akan menghapus folder .git beserta SEMUA history commit lokal!</span>\n`;
        termOutput.innerHTML += `<span class="text-yellow-600 dark:text-yellow-400">Yakin ingin melanjutkan? (ketik 'y' untuk Ya, 'n' untuk Batal): </span>`;
        termOutput.scrollTop = termOutput.scrollHeight;
        termInput.focus();
    });
}

// --- WELCOME SCREEN INTERACTIVE BUTTONS ---
document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'w-btn-clear-history') {
        localStorage.removeItem('ngappid_recent');
        renderRecentHistory();
    }
});

if (document.getElementById('w-btn-open-folder')) {
    document.getElementById('w-btn-open-folder').addEventListener('click', async () => {
        const result = await OpenFolderDialog();
        if (result && result.base_path) {
            addRecentProject(result.base_path);
            loadFolderData(result.base_path);
        }
    });
}

if (document.getElementById('w-btn-open-file')) {
    document.getElementById('w-btn-open-file').addEventListener('click', async () => {
        const fileInfo = await OpenFile();
        if (fileInfo && fileInfo.path) openTab(fileInfo.path, fileInfo.content);
    });
}

// --- GLOBAL SEARCH LOGIC ---
const globalSearchInput = document.getElementById('global-search-input');
const searchResultsContainer = document.getElementById('search-results');
const fileListContainer = document.getElementById('file-list');

if (globalSearchInput) {
    globalSearchInput.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
            const keyword = globalSearchInput.value.trim();
            
            if (!keyword) {
                searchResultsContainer.classList.add('hidden');
                fileListContainer.classList.remove('hidden');
                return;
            }

            if (!currentFolderPath) {
                logToTerminal("Search", "Buka folder project dulu sebelum mencari!", true);
                return;
            }

            fileListContainer.classList.add('hidden');
            searchResultsContainer.classList.remove('hidden');
            searchResultsContainer.innerHTML = '<div class="p-4 text-center text-xs text-blue-400 animate-pulse">⏳ Sedang mencari...</div>';

            try {
                const results = await SearchInFiles(currentFolderPath, keyword);
                renderSearchResults(results, keyword);
            } catch (err) {
                searchResultsContainer.innerHTML = `<div class="p-4 text-center text-xs text-red-400">Gagal mencari: ${err}</div>`;
            }
        }
    });
}

function renderSearchResults(results, keyword) {
    searchResultsContainer.innerHTML = ''; 

    const headerDiv = document.createElement('div');
    headerDiv.className = "flex justify-between items-center px-3 py-1.5 bg-[#2d2d2d] border-b border-[#444] text-[10px] font-bold text-gray-400 uppercase tracking-wider sticky top-0 z-10 shadow-md";
    headerDiv.innerHTML = `<span>${results ? results.length : 0} HASIL DITEMUKAN</span>`;
    
    const closeBtn = document.createElement('button');
    closeBtn.className = "hover:text-red-400 transition px-1 text-xs cursor-pointer";
    closeBtn.innerText = "✖";
    closeBtn.onclick = () => {
        globalSearchInput.value = '';
        searchResultsContainer.classList.add('hidden');
        fileListContainer.classList.remove('hidden');
    };
    headerDiv.appendChild(closeBtn);
    searchResultsContainer.appendChild(headerDiv);

    if (!results || results.length === 0) {
        searchResultsContainer.innerHTML += '<div class="p-4 text-center text-xs text-gray-500 italic">Tidak ada teks yang cocok.</div>';
        return;
    }

    results.forEach(res => {
        const fileName = res.path.split(/[/\\]/).pop();
        const resultItem = document.createElement('div');
        resultItem.className = "py-2 px-3 border-b border-[#333]/50 hover:bg-[#37373d] cursor-pointer group";
        
        const regex = new RegExp(`(${keyword})`, 'gi');
        const highlightedText = res.line_text
            .replace(/</g, "&lt;").replace(/>/g, "&gt;") 
            .replace(regex, `<span class="bg-blue-500/40 text-blue-100 rounded px-0.5">$1</span>`);

        resultItem.innerHTML = `
            <div class="flex justify-between items-center mb-1">
                <span class="text-xs font-semibold text-blue-300 truncate mr-2" title="${res.path}">📄 ${fileName}</span>
                <span class="text-[10px] text-gray-500 bg-[#1e1e1e] px-1.5 py-0.5 rounded border border-[#444]">Baris ${res.line_number}</span>
            </div>
            <div class="text-[11px] text-gray-400 font-mono truncate group-hover:text-gray-300">
                ${highlightedText.trim()}
            </div>
        `;

        resultItem.addEventListener('click', async () => {
            try {
                if (activeFilePath !== res.path) {
                    const content = await ReadFileByPath(res.path);
                    openTab(res.path, content);
                }
                
                setTimeout(() => {
                    if (editorInstance) {
                        editorInstance.revealLineInCenter(res.line_number);
                        editorInstance.setPosition({ lineNumber: res.line_number, column: 1 });
                        editorInstance.focus();
                    }
                }, 100);
            } catch (err) {
                logToTerminal("System", "Gagal membuka file dari pencarian: " + err, true);
            }
        });

        searchResultsContainer.appendChild(resultItem);
    });
}

// --- DROPDOWN MENUS & SYSTEM CONTEXT CONTROL ---
const gitDropdown = document.getElementById('git-dropdown');
const ftpDropdown = document.getElementById('ftp-dropdown'); 
const settingsDropdown = document.getElementById('settings-dropdown');

const btnGitMenu = document.getElementById('btn-git-menu');
const btnFtpMenu = document.getElementById('btn-ftp-menu'); 
const btnSettingsMenu = document.getElementById('btn-settings-menu');

// Fungsi sapu jagat untuk menutup SEMUA dropdown
const closeAllMenus = () => {
    if (gitDropdown) gitDropdown.classList.add('hidden');
    if (ftpDropdown) ftpDropdown.classList.add('hidden');
    if (settingsDropdown) settingsDropdown.classList.add('hidden');
};

// Logika Klik Menu GIT
if (btnGitMenu) {
    btnGitMenu.addEventListener('click', (e) => { 
        e.stopPropagation(); 
        const isHidden = gitDropdown.classList.contains('hidden');
        closeAllMenus(); // Tutup semua dulu
        if (isHidden) gitDropdown.classList.remove('hidden'); // Buka jika sebelumnya tertutup
    });
}

// Logika Klik Menu FTP
if (btnFtpMenu) {
    btnFtpMenu.addEventListener('click', (e) => { 
        e.stopPropagation(); 
        const isHidden = ftpDropdown.classList.contains('hidden');
        closeAllMenus();
        if (isHidden) ftpDropdown.classList.remove('hidden'); 
    });
}

// Logika Klik Menu SETTINGS
if (btnSettingsMenu) {
    btnSettingsMenu.addEventListener('click', (e) => { 
        e.stopPropagation(); 
        const isHidden = settingsDropdown.classList.contains('hidden');
        closeAllMenus();
        if (isHidden) settingsDropdown.classList.remove('hidden'); 
    });
}

// Klik sembarang tempat di luar menu = tutup semua
window.addEventListener('click', closeAllMenus);

// Cegah menu tertutup saat isinya sedang diklik
if (gitDropdown) gitDropdown.addEventListener('click', (e) => e.stopPropagation());
if (ftpDropdown) ftpDropdown.addEventListener('click', (e) => e.stopPropagation());
if (settingsDropdown) settingsDropdown.addEventListener('click', (e) => e.stopPropagation());

// Blokir klik kanan bawaan browser (kecuali di editor & terminal)
document.addEventListener('contextmenu', (e) => {
    const editorArea = document.getElementById('editor');
    const terminalInput = document.getElementById('terminal-input');
    if (!editorArea && !terminalInput) return;
    if ((editorArea && editorArea.contains(e.target)) || (terminalInput && e.target === terminalInput)) return;
    e.preventDefault();
});

// --- SETTINGS MODAL & THEME LOGIC ---
const settingsModal = document.getElementById('settings-modal');
const settingTheme = document.getElementById('setting-theme');
const settingFontSize = document.getElementById('setting-font-size');

if (document.getElementById('btn-editor-settings')) {
    document.getElementById('btn-editor-settings').addEventListener('click', () => {
        if (settingsDropdown) settingsDropdown.classList.add('hidden');

        const currentConfig = JSON.parse(localStorage.getItem('ngappid_settings')) || { theme: 'vs-dark', fontSize: 14 };
        if (settingTheme) settingTheme.value = currentConfig.theme;
        if (settingFontSize) settingFontSize.value = currentConfig.fontSize;
        if (settingsModal) settingsModal.classList.remove('hidden');
    });

    const closeSettings = () => { if (settingsModal) settingsModal.classList.add('hidden'); };
    if (document.getElementById('btn-cancel-settings')) document.getElementById('btn-cancel-settings').addEventListener('click', closeSettings);
    if (document.getElementById('btn-close-settings-x')) document.getElementById('btn-close-settings-x').addEventListener('click', closeSettings);

    if (document.getElementById('btn-save-settings')) {
        document.getElementById('btn-save-settings').addEventListener('click', () => {
            const newTheme = settingTheme ? settingTheme.value : 'vs-dark';
            const newFontSize = parseInt(settingFontSize ? settingFontSize.value : 14) || 14;
            
            const newConfig = { theme: newTheme, fontSize: newFontSize };
            localStorage.setItem('ngappid_settings', JSON.stringify(newConfig));
            
            if (typeof monaco !== 'undefined' && editorInstance) {
                monaco.editor.setTheme(newTheme); 
                editorInstance.updateOptions({ fontSize: newFontSize }); 
            }

            if (newTheme === 'vs') {
                document.documentElement.classList.remove('dark');
            } else {
                document.documentElement.classList.add('dark');
            }
            
            closeSettings();
            logToTerminal("Settings", "✔ Pengaturan tema dan font berhasil diterapkan.");
        });
    }
}

// --- APP STARTUP HANDLER ---
document.addEventListener("DOMContentLoaded", () => {
    renderRecentHistory();
    
    const savedConfig = JSON.parse(localStorage.getItem('ngappid_settings')) || { theme: 'vs-dark' };
    if (savedConfig.theme === 'vs') {
        document.documentElement.classList.remove('dark');
    } else {
        document.documentElement.classList.add('dark');
    }
});

// --- CLOSE PROJECT LOGIC ---
const btnCloseProject = document.getElementById('btn-close-project');
if (btnCloseProject) {
    btnCloseProject.addEventListener('click', (e) => {
        e.stopPropagation();
        
        currentFolderPath = "";
        localStorage.removeItem('lastFolder');
        expandedFolders.clear();
        
        tabs.forEach(t => t.model.dispose());
        tabs = [];
        activeFilePath = null;
        if (editorInstance) editorInstance.setModel(null);
        
        document.getElementById('sidebar').classList.add('hidden');
        document.getElementById('resizer').classList.add('hidden');
        document.getElementById('terminal-panel').classList.add('hidden');
        document.getElementById('file-list').innerHTML = '';
        
        renderTabs();
    });
}

// ==========================================
// QUICK TOGGLE WORD WRAP DARI DROPDOWN
// ==========================================
const btnToggleWordwrap = document.getElementById('btn-toggle-wordwrap');
const wordwrapStatus = document.getElementById('wordwrap-status');

if (btnToggleWordwrap) {
    // 1. Set status awal saat aplikasi pertama kali dimuat
    const currentConfig = JSON.parse(localStorage.getItem('ngappid_settings')) || { theme: 'vs-dark', fontSize: 14, wordWrap: 'off' };
    
    if (wordwrapStatus) {
        if (currentConfig.wordWrap === 'on') {
            wordwrapStatus.innerText = 'ON';
            wordwrapStatus.classList.add('text-green-600', 'dark:text-green-400');
        } else {
            wordwrapStatus.innerText = 'OFF';
        }
    }

    // 2. Event saat tombol word wrap di dropdown diklik
    btnToggleWordwrap.addEventListener('click', (e) => {
        e.stopPropagation(); // Biar menu gak ketutup sendiri sebelum script jalan
        
        // Ambil pengaturan terbaru
        let config = JSON.parse(localStorage.getItem('ngappid_settings')) || { theme: 'vs-dark', fontSize: 14, wordWrap: 'off' };
        
        // Balikkan statusnya (Toggle: kalau on jadi off, kalau off jadi on)
        config.wordWrap = config.wordWrap === 'on' ? 'off' : 'on';
        
        // Simpan ke local storage
        localStorage.setItem('ngappid_settings', JSON.stringify(config));
        
        // Terapkan ke Monaco Editor secara instan
        if (typeof monaco !== 'undefined' && editorInstance) {
            editorInstance.updateOptions({ wordWrap: config.wordWrap });
        }
        
        // Update tampilan label ON / OFF di dropdown
        if (wordwrapStatus) {
            wordwrapStatus.innerText = config.wordWrap === 'on' ? 'ON' : 'OFF';
            if (config.wordWrap === 'on') {
                wordwrapStatus.classList.add('text-green-600', 'dark:text-green-400');
            } else {
                wordwrapStatus.classList.remove('text-green-600', 'dark:text-green-400');
            }
        }
        
        // Tutup menu dropdown
        const settingsDropdown = document.getElementById('settings-dropdown');
        if (settingsDropdown) settingsDropdown.classList.add('hidden');
        
        logToTerminal("Settings", `✔ Word Wrap diubah menjadi: ${config.wordWrap.toUpperCase()}`);
    });
}

// ==========================================
// FTP MODAL & LOGIC CONTROLLER
// ==========================================
const ftpModal = document.getElementById('ftp-modal');

// 2. Tombol di dalam Menu Dropdown FTP
document.getElementById('btn-ftp-connect').addEventListener('click', () => {
    if (ftpDropdown) ftpDropdown.classList.add('hidden');
    if (ftpModal) ftpModal.classList.remove('hidden');
});

document.getElementById('btn-ftp-disconnect').addEventListener('click', async () => {
    if (ftpDropdown) ftpDropdown.classList.add('hidden');
    try {
        const msg = await FTPDisconnect();
        logToTerminal("FTP", msg);
    } catch (err) {
        logToTerminal("FTP", String(err), true);
    }
});

document.getElementById('btn-ftp-open').addEventListener('click', async () => {
    if (ftpDropdown) ftpDropdown.classList.add('hidden');
    const remotePath = await CustomPrompt("Masukkan path/lokasi file di server FTP\n(Contoh: public_html/index.php)");
    
    if (remotePath) {
        logToTerminal("FTP", `⏳ Mengunduh file ${remotePath} dari server...`);
        try {
            const content = await FTPReadFile(remotePath);
            // Tambahkan embel-embel "FTP://" supaya dibaca sebagai file server saat disave
            openTab("FTP://" + remotePath, content, true); 
            logToTerminal("FTP", `✔ Berhasil membuka ${remotePath}`);
        } catch (err) {
            logToTerminal("FTP Error", String(err), true);
        }
    }
});

// 3. Logika Form Modal Login FTP
document.getElementById('btn-cancel-ftp').addEventListener('click', () => {
    if (ftpModal) ftpModal.classList.add('hidden');
});

document.getElementById('btn-login-ftp').addEventListener('click', async () => {
    const host = document.getElementById('ftp-host').value.trim();
    const port = document.getElementById('ftp-port').value.trim();
    const user = document.getElementById('ftp-user').value.trim();
    const pass = document.getElementById('ftp-pass').value.trim();

    if (!host || !user) return await CustomAlert("Host dan Username tidak boleh kosong!");

    const btnLogin = document.getElementById('btn-login-ftp');
    btnLogin.innerText = "⏳ Connecting...";
    btnLogin.disabled = true;

    try {
        const msg = await FTPConnect(host, port, user, pass);
        logToTerminal("FTP Login", msg);
        if (ftpModal) ftpModal.classList.add('hidden');
    } catch (err) {
        logToTerminal("FTP Error", String(err), true);
    } finally {
        btnLogin.innerText = "Koneksikan";
        btnLogin.disabled = false;
    }
});

// ==========================================
// CUSTOM DIALOGS (PENGGANTI ALERT/CONFIRM/PROMPT BAWAAN)
// ==========================================
window.CustomDialog = function(type, message, defaultValue = "") {
    return new Promise((resolve) => {
        // Buat background overlay gelap
        const overlay = document.createElement('div');
        overlay.className = "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]";
        
        // Buat kotak dialog
        const box = document.createElement('div');
        box.className = "bg-white dark:bg-[#252526] p-5 rounded-lg shadow-xl w-80 border border-gray-300 dark:border-[#444] flex flex-col";
        
        const msgEl = document.createElement('p');
        msgEl.className = "text-sm text-gray-800 dark:text-gray-200 mb-4 whitespace-pre-wrap";
        msgEl.innerText = message;
        box.appendChild(msgEl);

        let inputEl;
        if (type === 'prompt') {
            inputEl = document.createElement('input');
            inputEl.type = "text";
            inputEl.value = defaultValue;
            inputEl.className = "w-full bg-gray-100 dark:bg-[#1e1e1e] border border-gray-300 dark:border-[#444] text-gray-800 dark:text-white px-2 py-1.5 text-sm rounded focus:outline-none mb-4 focus:border-blue-500";
            box.appendChild(inputEl);
        }

        const btnContainer = document.createElement('div');
        btnContainer.className = "flex justify-end gap-2";

        const closeDialog = (returnValue) => {
            document.body.removeChild(overlay);
            resolve(returnValue);
        };

        if (type === 'confirm' || type === 'prompt') {
            const btnCancel = document.createElement('button');
            btnCancel.innerText = "Batal";
            btnCancel.className = "px-4 py-1.5 bg-gray-300 dark:bg-[#333] hover:bg-gray-400 dark:hover:bg-[#444] text-gray-800 dark:text-gray-200 text-xs rounded transition";
            btnCancel.onclick = () => closeDialog(type === 'prompt' ? null : false);
            btnContainer.appendChild(btnCancel);
        }

        const btnOk = document.createElement('button');
        btnOk.innerText = "OK";
        btnOk.className = "px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition";
        btnOk.onclick = () => {
            if (type === 'prompt') closeDialog(inputEl.value);
            else if (type === 'confirm') closeDialog(true);
            else closeDialog(true); // alert
        };
        btnContainer.appendChild(btnOk);

        box.appendChild(btnContainer);
        overlay.appendChild(box);
        document.body.appendChild(overlay);

        // Kalau prompt, langsung fokus ke input box
        if (type === 'prompt') {
            inputEl.focus();
            inputEl.select();
            inputEl.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') btnOk.click();
                if (e.key === 'Escape') closeDialog(null);
            });
        }
    });
};

// Bikin fungsi pendek biar gampang dipanggil
window.CustomAlert = (msg) => CustomDialog('alert', msg);
window.CustomConfirm = (msg) => CustomDialog('confirm', msg);
window.CustomPrompt = (msg, def = "") => CustomDialog('prompt', msg, def);