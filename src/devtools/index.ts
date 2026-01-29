function createLogViewerPanel() {
  chrome.devtools.panels.create(
    "Sorbet Logs", // title
    "sorbet.png", // icon
    "log_panel_devtool.html", // content
    (newPanel) => {
      // newPanel.onShown.addListener(initPanel);
      // newPanel.onHidden.addListener(unInitialisePanel);
    }
  );
}

createLogViewerPanel();
