
enum LogLevel { TRACE, DEBUG, INFO, WARN, ERROR, FATAL }
let logLevel: LogLevel = LogLevel.DEBUG

let enableAppDebugging: boolean = true
const LogTags = {
    SORBET_LOG: "Sorbet:",
    SORBET_ERROR: "SORBET ERROR:",
    APP_INIT: "APP INITILIZATION",
    APP_MESSAGE: "APP MESSAGE",
    APP_ADDRESS_SCAN: "APP ADDRESS_SCAN",
}

/** Log wrapper */
const consoleLog = (...optionalParams: any[]) =>
    console.log(LogTags.SORBET_LOG, ...optionalParams)

/** Error wrapper */
const consoleErrorMessage = (message: string, ...optionalParams: any[]) => {
    console.error(LogTags.SORBET_ERROR, message, ...optionalParams)
}
const consoleError = (error?: Error, message?: string, ...optionalParams: any[]) => {
    if (error)
        console.log(error)
    if (message)
        consoleErrorMessage(message, optionalParams)
}

/** App logs */
const makeAppLogger = (tag: string) => (...data: any[]): void => {
    if (enableAppDebugging)
        consoleLog(tag, ...data)
}

/** External Interface */
export const Log = {
    /** DEBUG LOGGING */
    D: (...data: any[]): void => {
        if (logLevel <= LogLevel.DEBUG)
            consoleLog("DEBUG", ...data)
    },
    I: (...data: any[]): void => {
        if (logLevel <= LogLevel.INFO)
            consoleLog("WARN", ...data)
    },
    W: (...data: any[]): void => {
        if (logLevel <= LogLevel.WARN)
            consoleLog(...data)
    },
    E: (error: any, ...data: any[]): void => {
        if (logLevel <= LogLevel.ERROR) {
            if (typeof error === "string") {
                consoleErrorMessage(error, ...data)
            } else if (error instanceof Error) {
                consoleError(error, ...data)
            }
        }
    },
    App: {
        Init: makeAppLogger(LogTags.APP_INIT),
        Message: makeAppLogger(LogTags.APP_MESSAGE),
        AddressScan: makeAppLogger(LogTags.APP_ADDRESS_SCAN),
    }
}
