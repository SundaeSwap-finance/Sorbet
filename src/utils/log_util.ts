
const SORBET_LOG_TAG = "Sorbet:"
enum LogLevel { TRACE, DEBUG, INFO, WARN, ERROR, FATAL }
let logLevel:LogLevel = LogLevel.DEBUG

export const Log = {
    /** DEBUG LOGGING */
    D: (...data: any[]): void => {
        if (logLevel <= LogLevel.DEBUG)
            console.log(SORBET_LOG_TAG, ...data)
    }
}