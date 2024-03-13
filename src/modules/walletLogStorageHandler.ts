import { WalletLog } from "./walletLog";

const LOG_SCROLLBACK_LENGTH_DEFAULT = 30,
    WALLET_LOG_STORAGE_KEY = "walletLogs",
    WALLET_LOG_SCROLLBACK_STORAGE_KEY = "walletLogScrollback"

/** Retrieve log scrollback */
export function getWalletLogScrollback(callback: (scrollbackLength: number) => void): void {
    chrome.storage.local.get([WALLET_LOG_SCROLLBACK_STORAGE_KEY],
        (result) => {
            const scrollbackLength = result[WALLET_LOG_SCROLLBACK_STORAGE_KEY] ?? LOG_SCROLLBACK_LENGTH_DEFAULT
            callback(scrollbackLength)
        }
    )
}

/** Store log scrollback */
export function saveWalletLogScrollback(scrollbackLength: number): void {
    const payload = { [WALLET_LOG_SCROLLBACK_STORAGE_KEY]: scrollbackLength }
    chrome.storage.local.set(payload)
}

/** Retrieve logs */
export function retrieveWalletLogs(walletLogCallback: (walletLogs: WalletLog[]) => void): void {
    chrome.storage.local.get([WALLET_LOG_STORAGE_KEY, WALLET_LOG_SCROLLBACK_STORAGE_KEY],
        (result) => {
            const scrollbackLength: number = result[WALLET_LOG_SCROLLBACK_STORAGE_KEY] ?? LOG_SCROLLBACK_LENGTH_DEFAULT
            const walletLogs = trimLogsToScrollback(scrollbackLength, result[WALLET_LOG_STORAGE_KEY])
            walletLogCallback(walletLogs)
        }
    )
}

/** Trim logs */
function trimLogsToScrollback(scrollbackLength: number, walletLogs?: WalletLog[]) {
    const logs: WalletLog[] = walletLogs ?? []
    while (logs.length > scrollbackLength) {
        logs.shift()
    }
    return logs
}

/** Process a wallet log background request */
export function processWalletLogRequest(request: { payload: WalletLog }): any {
    const { payload } = request
    storeWalletLog(payload)
    return {}
}

/** Save logs to storage */
function storeWalletLog(newWalletLog: WalletLog) {
    retrieveWalletLogs((walletLogs) => {
        walletLogs.push(newWalletLog)
        chrome.storage.local.set({ walletLogs })
    })
}