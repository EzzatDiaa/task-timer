"use client";

import React, { useState, useEffect } from "react";
import { Task, TimerType, TimerStatus, TimerOperation } from "@/types/task";
import Link from "next/link";
import { formatDistanceToNow, format } from "date-fns";
import { useTimers } from "@/contexts/TimerContext";

interface TaskCardProps {
  task: Task;
  onUpdate: () => void;
}

const formatTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  return [
    hours.toString().padStart(2, "0"),
    minutes.toString().padStart(2, "0"),
    remainingSeconds.toString().padStart(2, "0"),
  ].join(":");
};

const TaskCard: React.FC<TaskCardProps> = ({ task, onUpdate }) => {
  const {
    getTimerState,
    startTimer,
    stopTimer,
    pauseTimer,
    resumeTimer,
    resetTimer,
  } = useTimers();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localRemainingTime, setLocalRemainingTime] = useState<
    number | undefined
  >(task.remainingTime);

  // Get timer state from context
  const timerState = getTimerState(task.id);
  const status = timerState?.status || task.timerStatus;
  const isPending = timerState?.isPending || false;

  // Update local remaining time when timerState changes
  useEffect(() => {
    if (timerState && timerState.remainingTime !== undefined) {
      setLocalRemainingTime(timerState.remainingTime);
    }
  }, [timerState]);

  // Timer interval for countdown visualization
  useEffect(() => {
    let interval: NodeJS.Timeout;

    // If countdown timer is running, update remaining time every second locally
    if (
      task.timerType === TimerType.COUNTDOWN &&
      status === TimerStatus.RUNNING &&
      localRemainingTime !== undefined &&
      localRemainingTime > 0
    ) {
      interval = setInterval(() => {
        setLocalRemainingTime((prev) => {
          if (prev === undefined || prev <= 0) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [task.timerType, status, localRemainingTime]);

  const handleTimerOperation = async (operation: TimerOperation) => {
    setError(null);

    try {
      switch (operation) {
        case TimerOperation.START:
          await startTimer(task.id);
          break;
        case TimerOperation.STOP:
          await stopTimer(task.id);
          break;
        case TimerOperation.PAUSE:
          await pauseTimer(task.id);
          break;
        case TimerOperation.RESUME:
          await resumeTimer(task.id);
          break;
        case TimerOperation.RESET:
          await resetTimer(task.id);
          break;
      }

      // Request notification permission if starting a timer
      if (
        operation === TimerOperation.START &&
        Notification.permission !== "granted"
      ) {
        Notification.requestPermission();
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to perform timer operation",
      );
    }
  };

  const handleDelete = async () => {
    if (window.confirm("Are you sure you want to delete this task?")) {
      setIsLoading(true);

      try {
        await taskAPI.deleteTask(task.id);
        onUpdate();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete task");
      } finally {
        setIsLoading(false);
      }
    }
  };

  const renderTimerControls = () => {
    const controls = [];

    if (status === TimerStatus.IDLE) {
      controls.push(
        <button
          key="start"
          onClick={() => handleTimerOperation(TimerOperation.START)}
          disabled={isLoading || isPending}
          className={`bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm ${
            isPending ? "opacity-70" : ""
          }`}
        >
          {isPending ? "Starting..." : "Start"}
        </button>,
      );
    }

    if (status === TimerStatus.RUNNING) {
      controls.push(
        <button
          key="pause"
          onClick={() => handleTimerOperation(TimerOperation.PAUSE)}
          disabled={
            isLoading || isPending || task.timerType === TimerType.ALARM
          }
          className={`${
            task.timerType === TimerType.COUNTDOWN
              ? `bg-yellow-500 hover:bg-yellow-600 ${isPending ? "opacity-70" : ""}`
              : "bg-gray-300 cursor-not-allowed"
          } text-white px-3 py-1 rounded text-sm mr-2`}
        >
          {isPending && timerState?.pendingOperation === TimerOperation.PAUSE
            ? "Pausing..."
            : "Pause"}
        </button>,
      );

      controls.push(
        <button
          key="stop"
          onClick={() => handleTimerOperation(TimerOperation.STOP)}
          disabled={isLoading || isPending}
          className={`bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm ${
            isPending ? "opacity-70" : ""
          }`}
        >
          {isPending && timerState?.pendingOperation === TimerOperation.STOP
            ? "Stopping..."
            : "Stop"}
        </button>,
      );
    }

    if (status === TimerStatus.PAUSED) {
      controls.push(
        <button
          key="resume"
          onClick={() => handleTimerOperation(TimerOperation.RESUME)}
          disabled={isLoading || isPending}
          className={`bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm mr-2 ${
            isPending ? "opacity-70" : ""
          }`}
        >
          {isPending && timerState?.pendingOperation === TimerOperation.RESUME
            ? "Resuming..."
            : "Resume"}
        </button>,
      );

      controls.push(
        <button
          key="stop"
          onClick={() => handleTimerOperation(TimerOperation.STOP)}
          disabled={isLoading || isPending}
          className={`bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm ${
            isPending ? "opacity-70" : ""
          }`}
        >
          {isPending && timerState?.pendingOperation === TimerOperation.STOP
            ? "Stopping..."
            : "Stop"}
        </button>,
      );
    }

    if (status === TimerStatus.COMPLETED) {
      controls.push(
        <button
          key="reset"
          onClick={() => handleTimerOperation(TimerOperation.RESET)}
          disabled={isLoading || isPending}
          className={`bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm ${
            isPending ? "opacity-70" : ""
          }`}
        >
          {isPending && timerState?.pendingOperation === TimerOperation.RESET
            ? "Resetting..."
            : "Reset"}
        </button>,
      );
    }

    return controls;
  };

  const renderTimerInfo = () => {
    if (task.timerType === TimerType.COUNTDOWN) {
      return (
        <div>
          <p className="text-sm text-gray-600 mb-1">
            Duration: {formatTime(task.countdownDuration || 0)}
          </p>
          {status === TimerStatus.RUNNING &&
            localRemainingTime !== undefined && (
              <p className="text-lg font-bold text-blue-600">
                Remaining: {formatTime(localRemainingTime)}
              </p>
            )}
          {status === TimerStatus.PAUSED &&
            localRemainingTime !== undefined && (
              <p className="text-lg font-bold text-yellow-600">
                Paused: {formatTime(localRemainingTime)}
              </p>
            )}
        </div>
      );
    } else if (task.timerType === TimerType.ALARM) {
      return (
        <div>
          <p className="text-sm text-gray-600 mb-1">
            Alarm set for:{" "}
            {task.alarmTime && format(new Date(task.alarmTime), "PPp")}
          </p>
          {status === TimerStatus.RUNNING && (
            <p className="text-lg font-bold text-blue-600">
              Time until alarm:{" "}
              {formatDistanceToNow(new Date(task.alarmTime || ""))}
            </p>
          )}
        </div>
      );
    }

    return null;
  };

  const getStatusBadge = () => {
    const badges = {
      [TimerStatus.IDLE]: "bg-gray-200 text-gray-800",
      [TimerStatus.RUNNING]: "bg-green-100 text-green-800",
      [TimerStatus.PAUSED]: "bg-yellow-100 text-yellow-800",
      [TimerStatus.COMPLETED]: "bg-blue-100 text-blue-800",
    };

    return (
      <span className={`${badges[status]} text-xs px-2 py-1 rounded-full`}>
        {isPending
          ? "Updating..."
          : status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    // Always maintain local countdown if this is a countdown timer that's running
    if (
      task.timerType === TimerType.COUNTDOWN &&
      status === TimerStatus.RUNNING &&
      localRemainingTime !== undefined &&
      localRemainingTime > 0
    ) {
      intervalId = setInterval(() => {
        setLocalRemainingTime((prev) => {
          if (prev === undefined || prev <= 0) {
            // If we hit zero locally, check with server
            checkServerStatus();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [task.timerType, status, localRemainingTime]);

  // Add a function to check with the server:
  const checkServerStatus = async () => {
    try {
      const response = await taskAPI.checkTimerStatus(task.id);

      // Update local state with server state
      if (response.status !== status) {
        // If server status is different, update it
        console.log(
          `Server status (${response.status}) is different from local status (${status}), updating`,
        );

        // If the server says it's completed, trigger appropriate actions
        if (response.status === TimerStatus.COMPLETED) {
          handleTimerCompletion();
        }
      }
    } catch (error) {
      console.error("Failed to check server status:", error);
    }
  };

  // Add a function to handle timer completion:
  const handleTimerCompletion = () => {
    // Play notification sound
    try {
      const audio = new Audio("/notification.mp3");
      audio.play().catch((e) => console.error("Failed to play sound:", e));
    } catch (e) {
      console.error("Error playing sound:", e);
    }

    // Show browser notification
    if (Notification && Notification.permission === "granted") {
      try {
        new Notification("Timer Completed", {
          body: `Task "${task.title}" has completed!`,
        });
      } catch (e) {
        console.error("Error showing notification:", e);
      }
    }
  };

  return (
    <div className="border rounded-lg shadow-sm p-4 bg-white">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded mb-3 text-sm">
          {error}
        </div>
      )}

      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="text-lg font-medium text-gray-900">{task.title}</h3>
          <p className="text-sm text-gray-500">
            Created {formatDistanceToNow(new Date(task.createdAt))} ago
          </p>
        </div>
        <div className="flex items-center">{getStatusBadge()}</div>
      </div>

      {task.description && (
        <p className="text-gray-700 mb-3">{task.description}</p>
      )}

      <div className="mb-4">
        <div className="flex items-center mb-2">
          <span
            className={`inline-block w-3 h-3 rounded-full mr-2 ${
              task.timerType === TimerType.COUNTDOWN
                ? "bg-purple-500"
                : "bg-indigo-500"
            }`}
          ></span>
          <span className="text-sm font-medium text-gray-700">
            {task.timerType === TimerType.COUNTDOWN
              ? "Countdown Timer"
              : "Alarm Timer"}
          </span>
        </div>

        {renderTimerInfo()}
      </div>

      <div className="border-t pt-3 flex justify-between">
        <div className="flex space-x-2">{renderTimerControls()}</div>

        <div className="flex space-x-2">
          <Link
            href={`/tasks/edit/${task.id}`}
            className="text-blue-500 hover:text-blue-700 text-sm"
          >
            Edit
          </Link>
          <button
            onClick={handleDelete}
            disabled={isLoading}
            className="text-red-500 hover:text-red-700 text-sm"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

export default TaskCard;
