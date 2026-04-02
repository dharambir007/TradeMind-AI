import { useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";
import { getSocketUrl } from "../utils/apiUrl";

function resolveSocketUrl() {
    return getSocketUrl();
}

const SOCKET_URL = resolveSocketUrl();
const LIVE_TICK_STALE_MS = 15000;

let sharedSocket = null;
let refCount = 0;

function normalizeSocketSymbol(raw) {
    const symbol = String(raw || "").trim().toUpperCase();
    if (!symbol) return "";

    if (
        symbol.startsWith("^") ||
        symbol.endsWith("=X") ||
        symbol.endsWith("=F") ||
        symbol.endsWith("-USD")
    ) {
        return symbol.replace(/\.(NS|BO)$/, "");
    }

    return symbol.includes(".") ? symbol : `${symbol}.NS`;
}

function getSocket() {
    if (!sharedSocket) {
        if (import.meta.env.DEV) {
            console.debug("[useSocket] connecting to", SOCKET_URL);
        }
        sharedSocket = io(SOCKET_URL, {
            transports: ["polling", "websocket"],
            upgrade: true,
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 2000,
            reconnectionDelayMax: 10000,
            timeout: 20000,
        });
    }
    refCount++;
    return sharedSocket;
}

function releaseSocket() {
    refCount--;
    if (refCount <= 0 && sharedSocket) {
        sharedSocket.disconnect();
        sharedSocket = null;
        refCount = 0;
    }
}

export function useSocket(symbol) {
    const socketRef = useRef(null);
    const [tick, setTick] = useState(null);
    const [connected, setConnected] = useState(() => Boolean(sharedSocket?.connected));
    const [live, setLive] = useState(false);
    const [streamInfo, setStreamInfo] = useState({
        provider: null,
        transport: null,
        fallback: false,
    });
    const currentSymbol = useRef(null);
    const pendingTickRef = useRef(null);
    const tickRafRef = useRef(null);
    const resetTickFrameRef = useRef(null);
    const lastLiveTickAtRef = useRef(0);

    useEffect(() => {
        const socket = getSocket();
        socketRef.current = socket;

        const onConnect = () => {
            setConnected(true);
            if (currentSymbol.current) {
                socket.emit("subscribe", currentSymbol.current);
            }
        };
        const onDisconnect = () => {
            setConnected(false);
            setLive(false);
        };
        const onTick = (data) => {
            const transport = String(data?.streamTransport || "").trim().toLowerCase();
            const isLiveStream = transport === "websocket" && data?.isLive !== false;

            if (isLiveStream) {
                lastLiveTickAtRef.current = Date.now();
            }

            setLive(isLiveStream);
            setStreamInfo({
                provider: data?.streamProvider || null,
                transport: transport || null,
                fallback: !isLiveStream,
            });
            pendingTickRef.current = data;

            // Batch frequent socket ticks to one state update per animation frame.
            if (!tickRafRef.current) {
                tickRafRef.current = requestAnimationFrame(() => {
                    tickRafRef.current = null;
                    const nextTick = pendingTickRef.current;
                    pendingTickRef.current = null;
                    if (!nextTick) return;

                    setTick((prev) => {
                        if (
                            prev &&
                            prev.price === nextTick.price &&
                            prev.symbol === nextTick.symbol &&
                            prev.time === nextTick.time &&
                            prev.volume === nextTick.volume
                        ) {
                            return prev;
                        }
                        return nextTick;
                    });
                });
            }
        };

        socket.on("connect", onConnect);
        socket.on("disconnect", onDisconnect);
        socket.on("tick", onTick);

        if (socket.connected) {
            requestAnimationFrame(() => setConnected(true));
        }

        const staleTimer = window.setInterval(() => {
            if (!lastLiveTickAtRef.current) {
                return;
            }

            if (Date.now() - lastLiveTickAtRef.current > LIVE_TICK_STALE_MS) {
                setLive(false);
            }
        }, 2000);

        return () => {
            socket.off("connect", onConnect);
            socket.off("disconnect", onDisconnect);
            socket.off("tick", onTick);
            window.clearInterval(staleTimer);
            if (tickRafRef.current) {
                cancelAnimationFrame(tickRafRef.current);
                tickRafRef.current = null;
            }
            pendingTickRef.current = null;
            if (resetTickFrameRef.current) {
                cancelAnimationFrame(resetTickFrameRef.current);
                resetTickFrameRef.current = null;
            }
            if (currentSymbol.current) {
                socket.emit("unsubscribe", currentSymbol.current);
                currentSymbol.current = null;
            }
            lastLiveTickAtRef.current = 0;
            releaseSocket();
        };
    }, []);

    useEffect(() => {
        const socket = socketRef.current;
        if (!socket) return;

        const nextSymbol = symbol ? normalizeSocketSymbol(symbol) : "";

        if (currentSymbol.current && currentSymbol.current !== nextSymbol) {
            socket.emit("unsubscribe", currentSymbol.current);
            currentSymbol.current = null;
        }

        if (!nextSymbol) {
            if (resetTickFrameRef.current) {
                cancelAnimationFrame(resetTickFrameRef.current);
            }
            resetTickFrameRef.current = requestAnimationFrame(() => {
                resetTickFrameRef.current = null;
                lastLiveTickAtRef.current = 0;
                setTick(null);
                setLive(false);
                setStreamInfo({
                    provider: null,
                    transport: null,
                    fallback: false,
                });
            });
            return;
        }

        socket.emit("subscribe", nextSymbol);
        currentSymbol.current = nextSymbol;
        if (resetTickFrameRef.current) {
            cancelAnimationFrame(resetTickFrameRef.current);
        }
        resetTickFrameRef.current = requestAnimationFrame(() => {
            resetTickFrameRef.current = null;
            lastLiveTickAtRef.current = 0;
            setTick(null);
            setLive(false);
            setStreamInfo({
                provider: null,
                transport: null,
                fallback: false,
            });
        });
    }, [symbol]);

    const subscribe = useCallback((sym) => {
        if (socketRef.current && sym) {
            const yahooSym = normalizeSocketSymbol(sym);
            socketRef.current.emit("subscribe", yahooSym);
        }
    }, []);

    const unsubscribe = useCallback((sym) => {
        if (socketRef.current && sym) {
            const yahooSym = normalizeSocketSymbol(sym);
            socketRef.current.emit("unsubscribe", yahooSym);
        }
    }, []);

    return { tick, connected, live, streamInfo, subscribe, unsubscribe };
}

export default useSocket;
