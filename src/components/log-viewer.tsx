import React, { useEffect, useState } from "react"
import { STORE_WALLET_LOG_ACTION, WalletLog } from "../modules/walletLog"
import { getWalletLogScrollback, retrieveWalletLogs, saveWalletLogScrollback } from "../modules/walletLogStorageHandler"
import { Box, TextField, Typography } from "@mui/material"


export const LogViewerComponent = (): JSX.Element => {
    const [stale, setStale] = useState(false)
    const [scrollback, setScrollback] = useState(0)
    const saveScrollback = (s: number) => { setScrollback(s); saveWalletLogScrollback(s); }
    const [walletLogs, setWalletLogs] = useState<WalletLog[]>([])
    useEffect(() => {
        const callback = (message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
            if (message.action === STORE_WALLET_LOG_ACTION) {
                setStale(stale => !stale)
            }
        }
        chrome.runtime.onMessage.addListener(callback)
        getWalletLogScrollback(setScrollback)
        return () => { chrome.runtime.onMessage.removeListener(callback) }
    }, [])
    useEffect(() => {
        retrieveWalletLogs((logs) => {
            setWalletLogs([...logs])
        })
    }, [stale])
    return (
        <>
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "row",
                    justifyContent: 'space-between',
                }}
            >
                <Typography component="h2" variant="h6" fontWeight="bold">
                    Log Viewer
                </Typography>
                <TextField
                    size='small'
                    sx={{ width: '10ch' }}
                    label="Scroll-Back"
                    variant="outlined"
                    type="number"
                    value={scrollback}
                    disabled={scrollback === undefined}
                    onChange={({ currentTarget: { value } }) => { saveScrollback(parseInt(value)) }} />
            </Box>
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "left",
                }}
            >
                {walletLogs.map((log, i) => (
                    <LogRow key={i} {...log} />
                ))}
            </Box>
        </>
    )
}
const logRowStyle = {
    display: "flex",
    flexDirection: "row",
    alignItems: "left",
    gap: 1,
    whiteSpace: 'nowrap',
    fontSize: 14,
}
interface LogRowProps extends WalletLog { }
const LogRow = ({ methodName, args, result, created }: LogRowProps): JSX.Element => (
    <>
        <Box sx={logRowStyle}>{new Date(created).toString()}</Box>
        <Box sx={logRowStyle}>
            <div>{methodName}</div>
            <div>({JSON.stringify(args)}) =&gt;</div>
            {!Array.isArray(result) &&
                <div>{JSON.stringify(result)}</div>}
        </Box>
        {Array.isArray(result) &&
            <Box sx={logRowStyle}>{JSON.stringify(result)}</Box>}
    </>
)