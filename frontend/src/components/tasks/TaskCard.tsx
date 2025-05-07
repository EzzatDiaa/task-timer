"use client";

import React, { useState, useEffect } from "react";
import { Task, TimerType, TimerStatus, TimerOperation } from "@/types/task";
import { taskAPI } from "@/services/api";
import Link from "next/link";
import { formatDistanceToNow, format } from "date-fns";

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
  const [status, setStatus] = useState<TimerStatus>(task.timerStatus);
  const [remainingTime, setRemainingTime] = useState<number | undefined>(
    task.remainingTime,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Timer interval for countdown
  useEffect(() => {
    let interval: NodeJS.Timeout;

    // If countdown timer is running, update remaining time every second
    if (
      task.timerType === TimerType.COUNTDOWN &&
      status === TimerStatus.RUNNING &&
      remainingTime !== undefined
    ) {
      interval = setInterval(() => {
        setRemainingTime((prev) => {
          if (prev === undefined || prev <= 0) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    // Periodically check timer status from server
    const statusInterval = setInterval(() => {
      if (status === TimerStatus.RUNNING) {
        checkTimerStatus();
      }
    }, 5000); // Check every 5 seconds

    return () => {
      clearInterval(interval);
      clearInterval(statusInterval);
    };
  }, [task.id, task.timerType, status, remainingTime]);

  const checkTimerStatus = async () => {
    try {
      const response = await taskAPI.checkTimerStatus(task.id);
      setStatus(response.status);

      if (response.remainingTime !== undefined) {
        setRemainingTime(response.remainingTime);
      }

      if (
        response.status === TimerStatus.COMPLETED &&
        status !== TimerStatus.COMPLETED
      ) {
        // Play notification sound
        const audio = new Audio("/notification.mp3");
        audio.play();

        // Show system notification
        if (Notification.permission === "granted") {
          new Notification("Task Timer", {
            body: `Task "${task.title}" has completed!`,
          });
        }

        // Trigger refresh of parent component
        onUpdate();
      }
    } catch (err) {
      console.error("Error checking timer status:", err);
    }
  };

  const handleTimerOperation = async (operation: TimerOperation) => {
    setIsLoading(true);
    setError(null);

    try {
      const updatedTask = await taskAPI.timerOperation(task.id, operation);
      setStatus(updatedTask.timerStatus);

      if (updatedTask.remainingTime !== undefined) {
        setRemainingTime(updatedTask.remainingTime);
      }

      // Request notification permission if starting a timer
      if (
        operation === TimerOperation.START &&
        Notification.permission !== "granted"
      ) {
        Notification.requestPermission();
      }

      onUpdate();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to perform timer operation",
      );
    } finally {
      setIsLoading(false);
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
          disabled={isLoading}
          className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm"
        >
          Start
        </button>,
      );
    }

    if (status === TimerStatus.RUNNING) {
      controls.push(
        <button
          key="pause"
          onClick={() => handleTimerOperation(TimerOperation.PAUSE)}
          disabled={isLoading || task.timerType === TimerType.ALARM}
          className={`${task.timerType === TimerType.COUNTDOWN ? "bg-yellow-500 hover:bg-yellow-600" : "bg-gray-300 cursor-not-allowed"} text-white px-3 py-1 rounded text-sm mr-2`}
        >
          Pause
        </button>,
      );

      controls.push(
        <button
          key="stop"
          onClick={() => handleTimerOperation(TimerOperation.STOP)}
          disabled={isLoading}
          className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm"
        >
          Stop
        </button>,
      );
    }

    if (status === TimerStatus.PAUSED) {
      controls.push(
        <button
          key="resume"
          onClick={() => handleTimerOperation(TimerOperation.RESUME)}
          disabled={isLoading}
          className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm mr-2"
        >
          Resume
        </button>,
      );

      controls.push(
        <button
          key="stop"
          onClick={() => handleTimerOperation(TimerOperation.STOP)}
          disabled={isLoading}
          className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm"
        >
          Stop
        </button>,
      );
    }

    if (status === TimerStatus.COMPLETED) {
      controls.push(
        <button
          key="reset"
          onClick={() => handleTimerOperation(TimerOperation.RESET)}
          disabled={isLoading}
          className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm"
        >
          Reset
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
          {status === TimerStatus.RUNNING && remainingTime !== undefined && (
            <p className="text-lg font-bold text-blue-600">
              Remaining: {formatTime(remainingTime)}
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
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
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
