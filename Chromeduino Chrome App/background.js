chrome.app.runtime.onLaunched.addListener(function() {
    chrome.app.window.create("windows/main/window.html", {
        "bounds": {
            "width": 800,
            "height": 700
        }
    });
});