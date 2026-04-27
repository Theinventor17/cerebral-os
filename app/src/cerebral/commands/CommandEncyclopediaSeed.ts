import type { CommandAction, CommandEncyclopediaEntry, CommandEncyclopediaMode } from './CommandEncyclopediaTypes'

const now = () => new Date().toISOString()

function entry(
  id: string,
  phrase: string,
  aliases: string[],
  mode: CommandEncyclopediaMode,
  category: CommandEncyclopediaEntry['category'],
  intent: string,
  action: CommandAction,
  risk: CommandEncyclopediaEntry['riskLevel'] = 'low',
  requiresConfirmation = false,
  thoughtPatterns?: string[]
): CommandEncyclopediaEntry {
  const t = now()
  return {
    id,
    phrase,
    aliases,
    mode,
    category,
    intent,
    action,
    riskLevel: risk,
    requiresConfirmation,
    thoughtPatterns,
    enabled: true,
    createdAt: t,
    updatedAt: t
  }
}

const hk = (keys: string[]): CommandAction => ({ type: 'hotkey', keys })
const sh = (command: string): CommandAction => ({ type: 'shell', command })
const k1 = (key: string): CommandAction => ({ type: 'keypress', key, presses: 1 })
const sock = (payload: string): CommandAction => ({ type: 'socket', host: '127.0.0.1', port: 8888, payload })

/** Structured seed (conceptually aligned with common command_map patterns). No API keys or secrets. */
export const COMMAND_ENCYCLOPEDIA_SEED: CommandEncyclopediaEntry[] = [
  entry('ce-win-desk', 'show hide desktop', ['toggle desktop', 'show desktop'], 'global', 'windows', 'Toggle desktop visibility', hk(['win', 'd'])),
  entry('ce-win-explore', 'open file explorer', ['explorer', 'file explorer'], 'global', 'windows', 'Open File Explorer', hk(['win', 'e'])),
  entry('ce-win-settings', 'open settings', ['windows settings'], 'global', 'windows', 'Open Windows Settings', hk(['win', 'i'])),
  entry('ce-win-lock', 'lock computer', ['lock screen'], 'global', 'windows', 'Lock workstation', hk(['win', 'l'])),
  entry('ce-win-run', 'open run', ['run dialog'], 'global', 'windows', 'Open Run', hk(['win', 'r'])),
  entry('ce-win-x', 'open quick link', ['win x menu', 'admin menu'], 'global', 'windows', 'Open power user menu', hk(['win', 'x'])),
  entry('ce-win-tab', 'open task view', ['task view'], 'global', 'windows', 'Task view / timeline', hk(['win', 'tab'])),
  entry('ce-win-m', 'minimize all', ['show desktop minimize all'], 'global', 'windows', 'Minimize all windows', hk(['win', 'm'])),
  entry('ce-win-sh-m', 'restore minimized', ['unminimize all'], 'global', 'windows', 'Restore minimized from taskbar', hk(['win', 'shift', 'm'])),
  entry('ce-alt-tab', 'switch apps', ['alt tab', 'task switcher'], 'global', 'navigation', 'Switch applications', hk(['alt', 'tab'])),
  entry('ce-alt-f4', 'close window', ['close active window'], 'global', 'windows', 'Close foreground window', hk(['alt', 'F4'])),
  entry('ce-taskmgr', 'open task manager', ['taskman'], 'global', 'system', 'Open Task Manager', hk(['ctrl', 'shift', 'esc'])),

  entry('ce-copy', 'copy text', ['copy selection'], 'global', 'text_editing', 'Copy', hk(['ctrl', 'c'])),
  entry('ce-cut', 'cut text', ['cut selection'], 'global', 'text_editing', 'Cut', hk(['ctrl', 'x'])),
  entry('ce-paste', 'paste text', ['paste from clipboard'], 'global', 'text_editing', 'Paste', hk(['ctrl', 'v'])),
  entry('ce-undo', 'undo action', ['undo last'], 'global', 'text_editing', 'Undo', hk(['ctrl', 'z'])),
  entry('ce-redo', 'redo action', ['redo last'], 'global', 'text_editing', 'Redo', hk(['ctrl', 'y'])),
  entry('ce-selall', 'select all', ['select all text'], 'global', 'text_editing', 'Select all', hk(['ctrl', 'a'])),
  entry('ce-find', 'find text', ['find in page'], 'global', 'text_editing', 'Find', hk(['ctrl', 'f'])),
  entry('ce-print', 'print document', ['print page'], 'global', 'text_editing', 'Print', hk(['ctrl', 'p'])),
  entry('ce-home', 'cursor start line', ['home line'], 'global', 'text_editing', 'Home (line start)', k1('Home')),
  entry('ce-end', 'cursor end line', ['end line'], 'global', 'text_editing', 'End (line end)', k1('End')),
  entry('ce-ctrl-home', 'cursor start doc', ['go to start of document'], 'global', 'text_editing', 'Start of document', hk(['ctrl', 'Home'])),
  entry('ce-ctrl-end', 'cursor end doc', ['go to end of document'], 'global', 'text_editing', 'End of document', hk(['ctrl', 'End'])),

  entry('ce-up', 'scroll up', ['line up'], 'global', 'navigation', 'Scroll up', k1('Up')),
  entry('ce-down', 'scroll down', ['line down'], 'global', 'navigation', 'Scroll down', k1('Down')),
  entry('ce-pgup', 'scroll page up', ['page up'], 'global', 'navigation', 'Page up', k1('PageUp')),
  entry('ce-pgdn', 'scroll page down', ['page down'], 'global', 'navigation', 'Page down', k1('PageDown')),
  entry('ce-zoom-in', 'zoom in', ['magnify'], 'global', 'navigation', 'Zoom in (browser / editor)', hk(['ctrl', '='])),
  entry('ce-zoom-out', 'zoom out', ['demagnify'], 'global', 'navigation', 'Zoom out', hk(['ctrl', '-'])),
  entry('ce-zoom-reset', 'reset zoom', ['100 percent zoom'], 'global', 'navigation', 'Reset zoom', hk(['ctrl', '0'])),

  entry('ce-fe-props', 'display properties', ['file properties'], 'global', 'file', 'File properties', hk(['alt', 'Enter'])),
  entry('ce-fe-back', 'go back', ['explorer back'], 'global', 'file', 'Back in File Explorer', hk(['alt', 'Left'])),
  entry('ce-fe-fwd', 'go forward', ['explorer forward'], 'global', 'file', 'Forward in File Explorer', hk(['alt', 'Right'])),
  entry('ce-fe-newwin', 'open new window', ['new explorer window'], 'global', 'file', 'New window', hk(['ctrl', 'n'])),
  entry('ce-fe-close', 'close current window', ['close explorer window'], 'global', 'file', 'Close window', hk(['ctrl', 'w'])),
  entry('ce-fe-newdir', 'create new folder', ['new directory'], 'global', 'file', 'New folder', hk(['ctrl', 'shift', 'n'])),
  entry('ce-fe-f2', 'rename item', ['rename file'], 'global', 'file', 'Rename', k1('F2')),
  entry('ce-fe-f3', 'search file folder', ['search in explorer'], 'global', 'file', 'Search in Explorer', k1('F3')),

  entry('ce-br-chrome', 'open browser', ['start chrome', 'open chrome'], 'global', 'browser', 'Start Chrome', sh('start chrome')),
  entry('ce-br-close-tab', 'close browser tab', ['close tab'], 'global', 'browser', 'Close tab', hk(['ctrl', 'w'])),
  entry('ce-br-edge', 'open edge', ['start edge'], 'global', 'browser', 'Start Edge', sh('start msedge')),
  entry('ce-br-incog', 'open incognito', ['chrome private'], 'global', 'browser', 'Chrome incognito', sh('start chrome --incognito')),
  entry('ce-br-newt', 'new browser tab', ['new tab'], 'global', 'browser', 'New tab', hk(['ctrl', 't'])),
  entry('ce-br-bm', 'bookmark page', ['add bookmark'], 'global', 'browser', 'Add bookmark', hk(['ctrl', 'd'])),
  entry('ce-br-bms', 'open bookmarks', ['bookmark manager'], 'global', 'browser', 'Bookmarks', hk(['ctrl', 'shift', 'o'])),
  entry('ce-br-hist', 'open history', ['browser history'], 'global', 'browser', 'History', hk(['ctrl', 'h'])),
  entry('ce-br-fs', 'full screen browser', ['f11 full screen'], 'global', 'browser', 'Fullscreen', k1('F11')),
  entry('ce-br-tabn', 'next browser tab', ['next tab'], 'global', 'browser', 'Next tab', hk(['ctrl', 'tab'])),
  entry('ce-br-tabp', 'previous browser tab', ['previous tab'], 'global', 'browser', 'Previous tab', hk(['ctrl', 'shift', 'tab'])),
  entry('ce-br-refresh', 'refresh page', ['reload page'], 'global', 'browser', 'Reload', hk(['ctrl', 'r'])),
  entry('ce-br-home', 'go to home page', ['browser home'], 'global', 'browser', 'Home', hk(['alt', 'Home'])),

  entry('ce-vol-up', 'volume up', ['louder'], 'global', 'media', 'Volume up', k1('AudioVolumeUp')),
  entry('ce-vol-dn', 'volume down', ['quieter'], 'global', 'media', 'Volume down', k1('AudioVolumeDown')),
  entry('ce-vol-mute', 'mute volume', ['silence'], 'global', 'media', 'Mute', k1('AudioVolumeMute')),
  entry('ce-media-play', 'play pause media', ['play pause'], 'global', 'media', 'Play/Pause', { type: 'keypress', key: 'MediaPlayPause' }),
  entry('ce-media-next', 'next track', ['skip track'], 'global', 'media', 'Next track', { type: 'keypress', key: 'MediaNextTrack' }),
  entry('ce-media-prev', 'prev track', ['previous track'], 'global', 'media', 'Previous track', { type: 'keypress', key: 'MediaPreviousTrack' }),

  entry('ce-creative-music', 'generate music', ['music gen'], 'imagine', 'creative', 'Generate music (local service)', sock('generate_music'), 'medium', true, ['imagine', 'push']),
  entry('ce-creative-img', 'generate images', ['image gen'], 'imagine', 'creative', 'Generate images (local service)', sock('generate_images'), 'medium', true, ['imagine', 'push']),
  entry('ce-creative-conv-s', 'conversation start', ['start local conv'], 'imagine', 'creative', 'Start conversation (socket)', sock('start_conversation'), 'low', true),
  entry('ce-creative-conv-e', 'conversation end', ['end local conv'], 'imagine', 'creative', 'End conversation (socket)', sock('end_conversation'), 'low', true),

  entry('ce-set-bt', 'open bluetooth settings', ['bluetooth'], 'global', 'system', 'Bluetooth settings', sh('start ms-settings:bluetooth'), 'low', true),
  entry('ce-set-sec', 'open windows security', ['defender'], 'global', 'system', 'Windows Security', sh('start windowsdefender:'), 'low', true),
  entry('ce-set-store', 'open windows store', ['microsoft store'], 'global', 'app_launch', 'Store', sh('start ms-windows-store:'), 'low', true),
  entry('ce-mail', 'open mail', ['outlook'], 'global', 'app_launch', 'Mail', sh('start outlookmail:'), 'low', true),
  entry('ce-maps', 'open maps', ['bing maps'], 'global', 'app_launch', 'Maps', sh('start bingmaps:'), 'low', true),
  entry('ce-photos', 'open photos', ['microsoft photos'], 'global', 'app_launch', 'Photos', sh('start ms-photos:'), 'low', true),
  entry('ce-camera', 'open camera', ['webcam app'], 'global', 'app_launch', 'Camera', sh('start microsoft.windows.camera:'), 'low', true),
  entry('ce-calc', 'open calculator', ['calc app'], 'global', 'app_launch', 'Calculator', sh('start calc'), 'low', true),
  entry('ce-notepad', 'open notepad', ['text notepad'], 'global', 'app_launch', 'Notepad', sh('start notepad'), 'low', true),
  entry('ce-wordpad', 'open wordpad', ['wordpad'], 'global', 'app_launch', 'WordPad', sh('start write'), 'low', true),
  entry('ce-control', 'open control panel', ['control'], 'global', 'system', 'Control Panel', sh('start control'), 'low', true),
  entry('ce-devmgr', 'open device manager', ['devmgmt'], 'global', 'system', 'Device Manager', sh('start devmgmt.msc'), 'low', true),
  entry('ce-diskmgmt', 'open disk management', ['disk mgmt'], 'global', 'system', 'Disk Management', sh('start diskmgmt.msc'), 'medium', true),
  entry('ce-msinfo', 'open system info', ['msinfo32'], 'global', 'system', 'System information', sh('start msinfo32'), 'low', true),
  entry('ce-osk', 'open on-screen keyboard', ['osk'], 'global', 'accessibility', 'On-Screen Keyboard', sh('start osk'), 'low', true),
  entry('ce-snip', 'open snipping tool', ['screenshot', 'snip'], 'global', 'system', 'Snipping Tool', sh('start snippingtool'), 'low', true),

  entry('ce-office-word', 'open word', ['winword', 'ms word'], 'global', 'app_launch', 'Word', sh('start winword'), 'low', true),
  entry('ce-office-excel', 'open excel', ['ms excel'], 'global', 'app_launch', 'Excel', sh('start excel'), 'low', true),
  entry('ce-office-pp', 'open powerpoint', ['ms powerpoint'], 'global', 'app_launch', 'PowerPoint', sh('start powerpnt'), 'low', true),

  entry(
    'ce-sys-shutdown',
    'shutdown computer',
    ['power off', 'turn off computer'],
    'global',
    'system',
    'Shutdown OS',
    sh('shutdown /s /t 1'),
    'high',
    true,
    ['drop', 'pull']
  ),
  entry(
    'ce-sys-restart',
    'restart computer',
    ['reboot'],
    'global',
    'system',
    'Restart OS',
    sh('shutdown /r /t 1'),
    'high',
    true,
    ['drop', 'pull']
  ),
  entry(
    'ce-sys-sleep',
    'sleep computer',
    ['suspend', 'standby'],
    'global',
    'system',
    'Sleep (legacy suspend)',
    sh('rundll32.exe powrprof.dll,SetSuspendState 0,1,0'),
    'high',
    true,
    ['drop']
  )
]
