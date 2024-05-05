function createLogViewerPanel () {
    console.log("Sorbet: creating log viewer devtool panel...")
    // const initPanel = () => {
    //     console.log('Sorbet: DEVTOOLS - user switched to log viewer devtool panel');
    // }
    chrome.devtools.panels
        .create(
            "Sorbet Logs", // title
            "sorget.png", // icon
            "log_panel_devtool.html", // content
            (newPanel) => {
                // newPanel.onShown.addListener(initPanel);
                // newPanel.onHidden.addListener(unInitialisePanel);
            });
}

createLogViewerPanel()
