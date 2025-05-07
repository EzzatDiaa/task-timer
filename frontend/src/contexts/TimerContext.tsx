// src/contexts/TimerContext.tsx
"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { getSocket } from "@/services/socket.service";
import { Task, TimerStatus, TimerOperation, TimerType } from "@/types/task";
import { taskAPI } from "@/services/api";
import { useAuth } from "./AuthContext";

interface TimerContextType {
  timers: Map<string, TimerState>;
  startTimer: (taskId: string) => Promise<void>;
  stopTimer: (taskId: string) => Promise<void>;
  pauseTimer: (taskId: string) => Promise<void>;
  resumeTimer: (taskId: string) => Promise<void>;
  resetTimer: (taskId: string) => Promise<void>;
  getTimerState: (taskId: string) => TimerState | undefined;
  refreshTimers: () => Promise<void>;
}

interface TimerState {
  taskId: string;
  status: TimerStatus;
  remainingTime?: number;
  startedAt?: Date;
  endTime?: Date;
  lastUpdated: Date;
  isCompleted: boolean;
  isPending: boolean; // For optimistic updates
  pendingOperation?: TimerOperation; // Current pending operation
}

const TimerContext = createContext<TimerContextType | undefined>(undefined);

export const useTimers = () => {
  const context = useContext(TimerContext);
  if (!context) {
    throw new Error("useTimers must be used within a TimerProvider");
  }
  return context;
};

export const TimerProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { token, user } = useAuth();
  const [timers, setTimers] = useState<Map<string, TimerState>>(new Map());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);

  // Initialize timers from tasks
  const initializeTimers = useCallback((tasks: Task[]) => {
    const newTimers = new Map<string, TimerState>();

    tasks.forEach((task) => {
      newTimers.set(task.id, {
        taskId: task.id,
        status: task.timerStatus,
        remainingTime:
          task.timerType === TimerType.COUNTDOWN
            ? task.remainingTime
            : undefined,
        startedAt: task.startedAt ? new Date(task.startedAt) : undefined,
        endTime:
          task.timerType === TimerType.ALARM && task.alarmTime
            ? new Date(task.alarmTime)
            : undefined,
        lastUpdated: new Date(),
        isCompleted: task.isCompleted || false,
        isPending: false,
      });
    });

    setTimers(newTimers);
  }, []);

  // Fetch tasks and initialize timers
  const refreshTimers = useCallback(async () => {
    try {
      const fetchedTasks = await taskAPI.getAllTasks();
      setTasks(fetchedTasks);
      initializeTimers(fetchedTasks);
    } catch (error) {
      console.error("Failed to fetch tasks:", error);
    }
  }, [initializeTimers]);

  // Initialize timers when component mounts
  useEffect(() => {
    if (user && !isInitialized) {
      refreshTimers();
      setIsInitialized(true);
    }
  }, [user, isInitialized, refreshTimers]);

  // Listen for socket events
  useEffect(() => {
    if (!token) return;

    const socket = getSocket();
    if (!socket) return;

    console.log("Setting up timer event listeners");

    // Add connection event handlers
    const onConnect = () => {
      console.log("Socket connected in TimerContext");
      setSocketConnected(true);

      // Refresh timers when socket connects
      refreshTimers();
    };

    const onDisconnect = () => {
      console.log("Socket disconnected in TimerContext");
      setSocketConnected(false);
    };

    // Handle timer updates from the server
    const handleTimerUpdate = (data: any) => {
      console.log("[Socket] Timer update received:", data);

      setTimers((prevTimers) => {
        const newTimers = new Map(prevTimers);
        const existingTimer = newTimers.get(data.taskId);

        if (existingTimer) {
          // Only update if this is not a pending operation
          // or if the update is newer than our last update
          if (
            !existingTimer.isPending ||
            new Date(data.lastUpdated) > existingTimer.lastUpdated
          ) {
            console.log(
              `Updating timer ${data.taskId} with status: ${data.status}`,
            );

            newTimers.set(data.taskId, {
              ...existingTimer,
              status: data.status,
              remainingTime: data.remainingTime,
              isCompleted: data.completed,
              lastUpdated: new Date(),
              // Clear pending state if we get a matching update for the pending operation
              isPending:
                existingTimer.isPending &&
                existingTimer.pendingOperation &&
                mapOperationToStatus(existingTimer.pendingOperation) !==
                  data.status
                  ? existingTimer.isPending
                  : false,
              pendingOperation:
                existingTimer.isPending &&
                existingTimer.pendingOperation &&
                mapOperationToStatus(existingTimer.pendingOperation) !==
                  data.status
                  ? existingTimer.pendingOperation
                  : undefined,
            });
          } else {
            console.log(`Ignoring update for pending timer ${data.taskId}`);
          }
        } else {
          // If timer doesn't exist in our state yet, add it
          console.log(`Adding new timer ${data.taskId} to state`);

          // Create a basic timer state object
          newTimers.set(data.taskId, {
            taskId: data.taskId,
            status: data.status,
            remainingTime: data.remainingTime,
            isCompleted: data.completed,
            lastUpdated: new Date(),
            isPending: false,
          });
        }

        return newTimers;
      });
    };

    // Handle notifications
    const handleNotification = (data: any) => {
      console.log("[Socket] Notification received:", data);

      if (data.type === "TIMER_COMPLETED") {
        // Show system notification
        if (Notification.permission === "granted") {
          try {
            new Notification(data.title, {
              body: data.message,
            });
          } catch (error) {
            console.error("Failed to show notification:", error);
          }
        }

        // Play sound
        try {
          const audio = new Audio("/notification.mp3");
          audio
            .play()
            .catch((err) =>
              console.error("Failed to play notification sound:", err),
            );
        } catch (error) {
          console.error("Error creating Audio object:", error);
        }

        // Update timer state
        setTimers((prevTimers) => {
          const newTimers = new Map(prevTimers);
          const existingTimer = newTimers.get(data.taskId);

          if (existingTimer) {
            console.log(`Marking timer ${data.taskId} as completed`);

            newTimers.set(data.taskId, {
              ...existingTimer,
              status: TimerStatus.COMPLETED,
              isCompleted: true,
              lastUpdated: new Date(),
              isPending: false,
              pendingOperation: undefined,
            });
          }

          return newTimers;
        });
      }
    };

    // Monitor heartbeat for connection health
    const handleHeartbeat = (data: any) => {
      console.log("[Socket] Heartbeat received:", data);
    };

    // Register all event listeners
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("timer:update", handleTimerUpdate);
    socket.on("notification", handleNotification);
    socket.on("heartbeat", handleHeartbeat);

    // Set initial connection status
    setSocketConnected(socket.connected);

    // Request a refresh if we're already connected
    if (socket.connected) {
      refreshTimers();
    }

    // Clean up event listeners on unmount
    return () => {
      console.log("Cleaning up timer event listeners");
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("timer:update", handleTimerUpdate);
      socket.off("notification", handleNotification);
      socket.off("heartbeat", handleHeartbeat);
    };
  }, [token, refreshTimers]);

  // Subscribe to specific task updates
  const subscribeToTask = useCallback((taskId: string) => {
    const socket = getSocket();
    if (socket) {
      socket.emit("subscribe:task", taskId);
    }
  }, []);

  // Helper to map operation to expected status
  const mapOperationToStatus = (operation: TimerOperation): TimerStatus => {
    switch (operation) {
      case TimerOperation.START:
        return TimerStatus.RUNNING;
      case TimerOperation.PAUSE:
        return TimerStatus.PAUSED;
      case TimerOperation.RESUME:
        return TimerStatus.RUNNING;
      case TimerOperation.STOP:
        return TimerStatus.COMPLETED;
      case TimerOperation.RESET:
        return TimerStatus.IDLE;
      default:
        return TimerStatus.IDLE;
    }
  };

  // Timer operation methods with optimistic updates
  const performTimerOperation = async (
    taskId: string,
    operation: TimerOperation,
  ) => {
    // Get current timer state
    const currentTimer = timers.get(taskId);
    if (!currentTimer) return;

    // Calculate optimistic state update
    const optimisticStatus = mapOperationToStatus(operation);

    // Apply optimistic update
    setTimers((prevTimers) => {
      const newTimers = new Map(prevTimers);
      const timerToUpdate = newTimers.get(taskId);

      if (timerToUpdate) {
        const now = new Date();

        // Prepare the optimistic update
        const updatedTimer: TimerState = {
          ...timerToUpdate,
          status: optimisticStatus,
          lastUpdated: now,
          isPending: true,
          pendingOperation: operation,
        };

        // For specific operations, update additional fields
        if (operation === TimerOperation.START) {
          updatedTimer.startedAt = now;
        } else if (operation === TimerOperation.STOP) {
          updatedTimer.isCompleted = true;
        } else if (operation === TimerOperation.RESET) {
          updatedTimer.isCompleted = false;
          updatedTimer.startedAt = undefined;
        }

        newTimers.set(taskId, updatedTimer);
      }

      return newTimers;
    });

    try {
      // Subscribe to updates for this task
      subscribeToTask(taskId);

      // Perform the actual API call
      await taskAPI.timerOperation(taskId, operation);

      // On success, keep the optimistic update (backend will send real update via socket)
    } catch (error) {
      console.error(`Timer operation ${operation} failed:`, error);

      // On failure, rollback the optimistic update
      setTimers((prevTimers) => {
        const newTimers = new Map(prevTimers);
        const timerToRollback = newTimers.get(taskId);

        if (timerToRollback && timerToRollback.isPending) {
          // Put back the original state (from before optimistic update)
          newTimers.set(taskId, {
            ...currentTimer,
            isPending: false,
            pendingOperation: undefined,
          });
        }

        return newTimers;
      });

      // Refresh from server to ensure consistency
      refreshTimers();
    }
  };

  // Individual timer operations
  const startTimer = (taskId: string) =>
    performTimerOperation(taskId, TimerOperation.START);
  const stopTimer = (taskId: string) =>
    performTimerOperation(taskId, TimerOperation.STOP);
  const pauseTimer = (taskId: string) =>
    performTimerOperation(taskId, TimerOperation.PAUSE);
  const resumeTimer = (taskId: string) =>
    performTimerOperation(taskId, TimerOperation.RESUME);
  const resetTimer = (taskId: string) =>
    performTimerOperation(taskId, TimerOperation.RESET);

  // Helper to get a specific timer's state
  const getTimerState = (taskId: string) => timers.get(taskId);

  const value = {
    timers,
    startTimer,
    stopTimer,
    pauseTimer,
    resumeTimer,
    resetTimer,
    getTimerState,
    refreshTimers,
  };

  return (
    <TimerContext.Provider value={value}>{children}</TimerContext.Provider>
  );
};
