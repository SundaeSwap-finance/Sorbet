
type LogLevel = 'TRACE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL' | 'APP'
let logLevel: LogLevel = 'DEBUG'

let enableAppDebugging: boolean = true
const LogTags = {
    SORBET_LOG: "Sorbet",
    SORBET_ERROR: "SORBET ERROR:",
    APP_INIT: "INITILIZATION",
    APP_MESSAGE: "MESSAGE",
    APP_ADDRESS_SCAN: "ADDRESS_SCAN",
    APP_P2P_CONNECT: "P2P_CONNECT",
}

const tagStyled = (color: string) => `
padding: 2px 4px; 
border-radius: 4px; 
border-size: 1;
border-color: ${color}; 
border-style: solid;
font-weight: bold';
`;
const baseTagStyle = tagStyled("#ff5900")
const appTagStyle = tagStyled("#0084b0")
const logTagStyle = (logLevel: LogLevel) => (
    logLevel === 'FATAL' || logLevel === 'ERROR' ? tagStyled("#FF0012") :
        logLevel === 'WARN' ? tagStyled("#FFD900") :
            logLevel === 'INFO' ? tagStyled("#0084B0") :
                logLevel === 'DEBUG' ? tagStyled("#5BE300") :
                    logLevel === 'APP' ? appTagStyle
                        : tagStyled("#5BE300")
)
/** Log wrapper */
const formatLogMessage = (thisCallsLevel: LogLevel, ...data: any[]) => 
    `%c${LogTags.SORBET_LOG}%c %c${thisCallsLevel.toString()}%c ${data.join(' ')}`

const consoleLog = (thisCallsLevel: LogLevel, ...optionalParams: any[]) => {
    if (logLevel <= thisCallsLevel)
        console.log(formatLogMessage(thisCallsLevel, ...optionalParams), baseTagStyle, '', logTagStyle(thisCallsLevel), '')
}

/** Error wrapper */
const consoleErrorMessage = (message: string, ...optionalParams: any[]) => {
    console.error(`%c${LogTags.SORBET_ERROR}%c`, message, ...optionalParams)
}
const consoleError = (error?: Error, message?: string, ...optionalParams: any[]) => {
    if (error)
        console.log(error)
    if (message)
        consoleErrorMessage(message, optionalParams)
}

/** App logs */
const makeAppLogger = (tag: string) => (...data: any[]): void => {
    const formatAppLogMessage = (tag: string, ...data: any[]) => (
        formatLogMessage('APP', `%c${tag}%c ${data.join(" ")}`)
    )
    if (enableAppDebugging)
        console.log(formatAppLogMessage(tag, ...data), baseTagStyle, '', logTagStyle('APP'), '', appTagStyle, '')
}

/** External Interface */
export const Log = {
    /** DEBUG LOGGING */
    D: (...data: any[]): void => {
        consoleLog('DEBUG', ...data)
    },
    I: (...data: any[]): void => {
        consoleLog('WARN', ...data)
    },
    W: (...data: any[]): void => {
        consoleLog('WARN', ...data)
    },
    E: (error: any, ...data: any[]): void => {
        if (logLevel <= 'ERROR') {
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
        P2PConnect: makeAppLogger(LogTags.APP_P2P_CONNECT),
    }
}