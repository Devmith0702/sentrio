// background.js

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  if (message.type === "ANALYSE_THREAT") {
    // Forward to Person 2's AI agent when ready
    // analyseWithAI(message.payload).then(verdict => {
    //   chrome.tabs.sendMessage(sender.tab.id, {
    //     type: "SHOW_VERDICT",
    //     payload: verdict
    //   })
    // })
    console.log("Sentrio: threat signals received", message.payload)
    return true
  }

  if (message.type === "PAGE_SAFE") {
    chrome.tabs.sendMessage(sender.tab.id, {
      type: "SHOW_SAFE",
      payload: message.payload
    })
  }

})
