import { useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";

function resolveSocketUrl() {
    const apiBase = import.meta.env.VITE_API_BASE_URL;
    if (typeof apiBase === "string" && apiBase.trim()) {
        if (/^https?:\/\//i.test(apiBase)) {
            return apiBase.replace(/\/api\/?$/i, "");
        }
        // Relative API base like "/api": use current origin.
        return window.location.origin;
    }
    return "http://localhost:5000";
}

const SOCKET_URL = resolveSocketUrl();

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
            transports: ["websocket", "polling"],
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 10000,
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
    const currentSymbol = useRef(null);
    const pendingTickRef = useRef(null);
    const tickRafRef = useRef(null);
    const resetTickFrameRef = useRef(null);

    useEffect(() => {
        const socket = getSocket();
        socketRef.current = socket;

        const onConnect = () => setConnected(true);
        const onDisconnect = () => setConnected(false);
        const onTick = (data) => {
            pendingTickRef.current = data;

            // Batch frequent socket ticks to one state update per animation frame.
            if (!tickRafRef.current) {
                tickRafRef.current = requestAnimationFrame(() => {
                    tickRafRef.current = null;
                    const nextTick = pendingTickRef.current;
                    pendingTickRef.current = null;
                    if (!nextTick) return;

                    setTick((prev) => {
                        if (prev && prev.price === nextTick.price && prev.symbol === nextTick.symbol) return prev;
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

        return () => {
            socket.off("connect", onConnect);
            socket.off("disconnect", onDisconnect);
            socket.off("tick", onTick);
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
            releaseSocket();
        };
    }, []);

    useEffect(() => {
        const socket = socketRef.current;
        if (!socket) return;

        if (currentSymbol.current && currentSymbol.current !== symbol) {
            socket.emit("unsubscribe", currentSymbol.current);
        }

        if (symbol) {
            const yahooSymbol = normalizeSocketSymbol(symbol);
            socket.emit("subscribe", yahooSymbol);
            currentSymbol.current = yahooSymbol;
            if (resetTickFrameRef.current) {
                cancelAnimationFrame(resetTickFrameRef.current);
            }
            resetTickFrameRef.current = requestAnimationFrame(() => {
                resetTickFrameRef.current = null;
                setTick(null);
            });
        }
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

    return { tick, connected, subscribe, unsubscribe };
}

export default useSocket;
