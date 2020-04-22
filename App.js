import * as utils from './utils.js';


/*
Config settings for Modos. 
*/
var config;
var configIsLoaded = false;

const loadConfig = async () => {
    const configString = await utils.loadJSON('config.json');
    console.log(`Config: ${config}`);
    config = JSON.parse(configString);
};

loadConfig();

/**
 * Returns the local path of the app icon. 
 * @param {string} appName The app name
 */
const getAppIcon = appName => {
    console.log(`Loading icon for ${appName}`)
    // if (!configIsLoaded) await loadConfig();
    // const iconPath = 
    return `./assets/app-icons/${appName}.png`;
}

/**
 * The modes that should match BTT's configuration, 
 * each one for a separate macOS space/desktop. 
 * 
 * CHANGE THIS TO MATCH YOUR SETUP.
 */
const MODES = [
    "General",
    "Developer",
    "Designer",
    "Music"
];

/**
 * How often (in milliseconds) to poll data about running app, windows, modes.
 */
const REFRESH_RATE = 500;

var currentAppName;
var currentWindowTitle;
var currentNumberOfWindows = 0;
var currentMode = '';
var enabled = false;
var focused = false;

/*

POLLING INFO FROM APPLESCRIPTS

*/

async function refreshCurrentAppInfo() {

    const spinner = document.getElementById("loading-spinner");
    if (spinner.classList.contains('show')) {
        spinner.classList.remove('show');
        spinner.classList.add('hide');
    }

    let appleScript = `
        set windowName to "..."
        set currentAppName to ""
        set currentAppTitle to "Loading..."
        set numberOfWindows to "0"
        try
            tell application "System Events"
                set currentApp to first application process whose frontmost is true
                set currentAppName to name of currentApp
                tell process currentAppName
                    tell (1st window whose value of attribute "AXMain" is true)
                        set windowName to value of attribute "AXTitle"
                    end tell
                    set currentAppTitle to title of currentApp
                    set numberOfWindows to count of windows
                end tell
            end tell
        end try

        return {currentAppTitle, currentAppName, windowName, numberOfWindows}
    `;

    // @ts-ignore
    let result = await runAppleScript({ script: appleScript });
    let [appTitle, appName, windowTitle, numberOfWindows] = eval(result.replace('{', '[').replace('}', ']'));
    
    // What changed ?
    const appChanged = currentAppName !== appName;
    const windowChanged = currentWindowTitle !== windowTitle;
    const numberOfWindowsChanged = currentNumberOfWindows !== numberOfWindows;

    // Set new values
    currentAppName = appName;
    currentWindowTitle = windowTitle;
    currentNumberOfWindows = numberOfWindows;

    if (appChanged) {
        document.getElementById("current-app-name").textContent = `${appTitle}`;
        document.getElementById("current-app-window-count-container").classList.add('show');
        document.getElementById("current-app-window-count-container").classList.remove('hide');
        document.getElementById("current-app-window-count").textContent = numberOfWindows;
        document.getElementById("current-window-name").textContent = appTitle === windowTitle ? "" : windowTitle;
        document.getElementById("current-app-icon").setAttribute('src', getAppIcon(appTitle));
    } else if (windowChanged) {
        document.getElementById("current-app-window-count-container").classList.add('show');
        document.getElementById("current-app-window-count-container").classList.remove('hide');
        document.getElementById("current-app-window-count").textContent = numberOfWindows;
        document.getElementById("current-window-name").textContent = appTitle === windowTitle ? "" : windowTitle;
    } else if (numberOfWindowsChanged) {
        document.getElementById("current-app-window-count").textContent = numberOfWindows;
    }
}

/*
AUTOMATIC UPDATES
*/

/**
 * Refreshes the enabled/disabled status.
 */
async function refreshEnabledStatus() {
    // @ts-ignore
    try {
        let result = await callBTT('get_string_variable', { variable_name: 'customVariable3' });
        let newEnabled = result === 'enabled';
        const changed = enabled !== newEnabled;
        
        if (changed) {
            enabled = newEnabled;
            // Update UI 
            const onOff = document.getElementById('on-off');
            if (enabled) {
                onOff.classList.add('on');
                onOff.classList.remove('off');
            } else {
                onOff.classList.add('off');
                onOff.classList.remove('on');
            }
        }
    } catch(e) {

    }
    
}
/**
 * Refreshes the focused/default status.
 */
async function refreshFocusedStatus() {
    // @ts-ignore
    try {
        let result = await callBTT('get_string_variable', { variable_name: 'customVariable2' });
        let newFocused = result === 'focus';
        const changed = focused !== newFocused;
        
        if (changed) {
            focused = newFocused;
            // Update UI 
            const toolbar = document.getElementById('modos-toolbar');
            if (focused) {
                toolbar.classList.add('hide');
                toolbar.classList.remove('show');
            } else {
                toolbar.classList.add('show');
                toolbar.classList.remove('hide');
            }
        }
    } catch(e) {

    }
    
}

/**
 * Refreshes the current window preset mode. 
 */
async function refreshCurrentMode() {
    // @ts-ignore
    let newMode = await callBTT('get_string_variable', { variable_name: 'customVariable1' });
    const changed = currentMode !== newMode;
    if (changed) {
        currentMode = newMode;
        refreshModeList();
    }
}


function setModeList() {
    // Set the modes
    var modeList = document.getElementById("mode-list");
    MODES.forEach(mode => {
        let child = document.createElement('li');
        child.className = 'mode-list-item';
        let content = document.createElement('h3');
        content.innerText = mode;
        if (mode === currentMode) {
            child.id = 'current-mode';
        }
        child.appendChild(content);

        // Assign mode selector
        child.onclick = () => selectMode(mode);

        modeList.appendChild(child);
    });
}

function refreshModeList() {
    // Set the modes
    var modeList = document.getElementById("mode-list");
    MODES.forEach((mode, index) => {
        let child = modeList.children[index];
        if (mode === currentMode) {
            child.id = 'current-mode';
        } else {
            child.id = null;
        }
    });
}

/*

BTT LIFECYCLE HOOKS

*/

/* This is called after the webview content has loaded*/
function BTTInitialize() {

}

/* This is called before the webview exits and destroys its content*/
function BTTWillCloseWindow() {

}

/* This is called before the webview hides*/
function BTTWillHideWindow() {

}

/* This is called when the webview becomes visible*/
function BTTWindowWillBecomeVisible() {

}

/* This is called when a script variable in BTT changes. */
function BTTNotification(note) {
    let data = JSON.parse(note);
    console.log(data.note, data.name);
}

/*
SYSTEM ACTIONS
*/

async function showNotification(title, subtitle, text) {

    let shellScript = `osascript -e 'display notification \"${text}\" with title \"${title}\" subtitle \"${subtitle}\" sound name "Pop"'`;


    let shellScriptWrapper = {
        script: shellScript, // mandatory
        launchPath: '/bin/bash', //optional - default is /bin/bash
        parameters: '-c', // optional - default is -c
        environmentVariables: '' //optional e.g. VAR1=/test/;VAR2=/test2/;
    };

    //@ts-ignore
    await runShellScript(shellScriptWrapper);

}

/*

USER ACTIONS

*/

async function selectMode(mode) {
    //@ts-ignore
    callBTT('set_string_variable', { variable_name: 'customVariable1', to: mode });
}

export async function savePreset() {
    console.log('Save preset');

    let actionDefinition = {
        "BTTPredefinedActionType": 105,
        "BTTPredefinedActionName": "Show BTT Preferences",
    };

    //@ts-ignore
    let result = await callBTT('trigger_action', { json: JSON.stringify(actionDefinition) });
    console.log(result);
    if (result === "success") {
        await showNotification("Modos", "BetterTouchTool", `${currentMode} window preset saved!`);
    }
}

export async function restorePreset() {
    console.log('Restore preset');

    let actionDefinition = {
        "BTTTriggerType": -1,
        "BTTTriggerClass": "BTTTriggerTypeOtherTriggers",
        "BTTPredefinedActionType": 268,
        "BTTPredefinedActionName": "Save \/ restore specific window layout",
        "BTTWindowLayoutName": currentMode
    };

    //@ts-ignore
    let result = await callBTT('trigger_named', { trigger_name: `Restore Layout` });
    console.log(result);
    if (result === "success") {
        await showNotification("Modos", "BetterTouchTool", `${currentMode} window preset restored!`);
    }
}

export async function closeWebView() {
    await callBTT('trigger_named', { trigger_name: 'test', closeFloatingWebView: 1 });
}

function showKeyboardControlsHint(show) {
    if (show) {
        // Show keyboard controls hint
        var keyboardControlsLeft = document.getElementById("keyboard-controls-left");
        var keyboardControlsRight = document.getElementById("keyboard-controls-right");

        keyboardControlsLeft.classList.add("show");
        keyboardControlsLeft.classList.remove("hide");

        keyboardControlsRight.classList.add("show");
        keyboardControlsRight.classList.remove("hide");
    } else {
        // Hide keyboard controls hint

        var keyboardControlsLeft = document.getElementById("keyboard-controls-left");
        var keyboardControlsRight = document.getElementById("keyboard-controls-right");

        keyboardControlsLeft.classList.add("hide");
        keyboardControlsLeft.classList.remove("show");

        keyboardControlsRight.classList.add("hide");
        keyboardControlsRight.classList.remove("show");
    }
}

// Check the current app every 2 seconds
setInterval(async () => {
    console.log('Getting current app...')
    await refreshCurrentAppInfo();
    await refreshEnabledStatus();
    await refreshFocusedStatus();
    await refreshCurrentMode(); // It would be great if BTT could have reactive hooks so we don't have to poll.
}, REFRESH_RATE);

// Toolbar on click
var toolbarSelected = false;
var toolbarElement = document.getElementById("modos-toolbar");
toolbarElement.classList.remove('fade-out');
toolbarElement.classList.add('fade-in');
toolbarElement.classList.add('modos-toolbar-default');

toolbarElement.onclick = (mouseEvent) => {
    console.log('CLICK')
    toolbarSelected = !toolbarSelected;
    if (toolbarSelected) {
        // Show highlight
        toolbarElement.classList.add("modos-toolbar-selected");
        toolbarElement.classList.remove("modos-toolbar-default");
        showKeyboardControlsHint(true);

    } else {
        toolbarElement.classList.add('modos-toolbar-default');
        toolbarElement.classList.remove('modos-toolbar-selected');
        showKeyboardControlsHint(false);
    }
}

document.getElementById('save-button').onclick = savePreset;
document.getElementById('restore-button').onclick = restorePreset;
document.getElementById('close-button').onclick = closeWebView;


// Key listeners
document.onkeydown = checkKey;

function checkKey(e) {

    e = e || window.event;
    if (toolbarSelected) {
        if (e.keyCode == '38') {
            // up arrow
        }
        else if (e.keyCode == '40') {
            // down arrow
        }
        else if (e.keyCode == '37') {
            // left arrow
            selectMode(MODES[Math.max(0, MODES.indexOf(currentMode) - 1)]);
        }
        else if (e.keyCode == '39') {
            // right arrow
            selectMode(MODES[Math.min(MODES.length - 1, MODES.indexOf(currentMode) + 1)]);
        }
    }
}

setModeList();
showKeyboardControlsHint(false);
