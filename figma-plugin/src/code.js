// The d2s plugin's Figma side. It runs in Figma's sandbox and handles what only
// Figma can do: the user's name, the selection, moving to a frame, remembering
// settings on this computer, and linking explorations to this file. Everything
// about the documents happens in the panel (ui.js).

figma.showUI(__html__, { width: 420, height: 680, themeColors: true, title: 'discovery-to-spec' });

var LINKS_KEY = 'd2s-explorations';
var FILE_URL_KEY = 'd2s-file-url';

function selection() {
  return figma.currentPage.selection.map(function (node) {
    return { id: node.id, name: node.name, type: node.type };
  });
}

function linked() {
  try {
    return JSON.parse(figma.root.getPluginData(LINKS_KEY) || '[]');
  } catch (e) {
    return [];
  }
}

async function handle(msg) {
  switch (msg.type) {
    case 'init':
      return {
        user: figma.currentUser ? figma.currentUser.name : '',
        fileKey: figma.fileKey || '',
        fileName: figma.root.name,
        fileUrl: figma.root.getPluginData(FILE_URL_KEY),
        linked: linked(),
        settings: (await figma.clientStorage.getAsync('d2s-settings')) || null,
        drafts: (await figma.clientStorage.getAsync('d2s-drafts')) || {},
        selection: selection(),
      };
    case 'store':
      if (msg.value === null) await figma.clientStorage.deleteAsync(msg.key);
      else await figma.clientStorage.setAsync(msg.key, msg.value);
      return true;
    case 'link': {
      var list = linked();
      if (list.indexOf(msg.ref) < 0) list.push(msg.ref);
      figma.root.setPluginData(LINKS_KEY, JSON.stringify(list));
      return list;
    }
    case 'set-file-url':
      figma.root.setPluginData(FILE_URL_KEY, msg.url);
      return true;
    case 'show-node': {
      var node = await figma.getNodeByIdAsync(msg.nodeId);
      if (!node || node.type === 'DOCUMENT' || node.type === 'PAGE') return false;
      var page = node.parent;
      while (page && page.type !== 'PAGE') page = page.parent;
      if (page && page !== figma.currentPage) await figma.setCurrentPageAsync(page);
      figma.currentPage.selection = [node];
      figma.viewport.scrollAndZoomIntoView([node]);
      return true;
    }
    case 'open-url':
      figma.openExternal(msg.url);
      return true;
    case 'notify':
      figma.notify(msg.text, { error: !!msg.error });
      return true;
    default:
      throw new Error('Unknown message: ' + msg.type);
  }
}

figma.ui.onmessage = function (msg) {
  if (!msg || !msg.type) return;
  handle(msg).then(
    function (result) { figma.ui.postMessage({ type: 'reply', id: msg.id, result: result }); },
    function (err) { figma.ui.postMessage({ type: 'reply', id: msg.id, error: String((err && err.message) || err) }); }
  );
};

figma.on('selectionchange', function () {
  figma.ui.postMessage({ type: 'selection', nodes: selection() });
});
figma.on('currentpagechange', function () {
  figma.ui.postMessage({ type: 'selection', nodes: selection() });
});
