// frontend/src/components/tasks/TaskForm.tsx
"use client";

import React, { useState, useEffect } from "react";
import { CreateTaskDto, UpdateTaskDto, TimerType, Task } from "@/types/task";

interface TaskFormProps {
  initialData?: Task;
  onSubmit: (data: CreateTaskDto | UpdateTaskDto) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  onCancel: () => void;
  mode: "create" | "edit";
}

const TaskForm: React.FC<TaskFormProps> = ({
  initialData,
  onSubmit,
  isLoading,
  error,
  onCancel,
  mode,
}) => {
  // Form state
  const [formData, setFormData] = useState<CreateTaskDto | UpdateTaskDto>({
    title: "",
    description: "",
    timerType: TimerType.COUNTDOWN,
    countdownDuration: 1800, // Default 30 minutes
    isAutoRepeat: false,
  });

  // Time picker state for countdown
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(30);
  const [seconds, setSeconds] = useState(0);

  // Date picker state for alarm
  const [alarmDate, setAlarmDate] = useState("");
  const [alarmTime, setAlarmTime] = useState("");

  // Initialize form data from initialData if in edit mode
  useEffect(() => {
    if (mode === "edit" && initialData) {
      setFormData({
        title: initialData.title,
        description: initialData.description || "",
        timerType: initialData.timerType,
        countdownDuration: initialData.countdownDuration,
        alarmTime: initialData.alarmTime,
        isAutoRepeat: initialData.isAutoRepeat || false,
      });

      // Initialize time inputs
      if (
        initialData.timerType === TimerType.COUNTDOWN &&
        initialData.countdownDuration
      ) {
        const totalSeconds = initialData.countdownDuration;
        setHours(Math.floor(totalSeconds / 3600));
        setMinutes(Math.floor((totalSeconds % 3600) / 60));
        setSeconds(totalSeconds % 60);
      } else if (
        initialData.timerType === TimerType.ALARM &&
        initialData.alarmTime
      ) {
        const date = new Date(initialData.alarmTime);
        setAlarmDate(date.toISOString().split("T")[0]);
        setAlarmTime(date.toISOString().split("T")[1].substring(0, 5));
      }
    }
  }, [mode, initialData]);

  // Handle input changes
  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Handle timer type change
  const handleTimerTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const timerType = e.target.value as TimerType;

    if (timerType === TimerType.COUNTDOWN) {
      setFormData({
        ...formData,
        timerType,
        countdownDuration: hours * 3600 + minutes * 60 + seconds,
        alarmTime: undefined,
      });
    } else {
      const combinedDateTime = createDateTimeString();
      setFormData({
        ...formData,
        timerType,
        alarmTime: combinedDateTime,
        countdownDuration: undefined,
      });
    }
  };

  // Create ISO string from date and time inputs
  const createDateTimeString = (): string => {
    if (!alarmDate || !alarmTime) return "";
    return new Date(`${alarmDate}T${alarmTime}`).toISOString();
  };

  // Handle countdown time changes
  const handleTimeChange = (
    field: "hours" | "minutes" | "seconds",
    value: number,
  ) => {
    if (field === "hours") setHours(value);
    if (field === "minutes") setMinutes(value);
    if (field === "seconds") setSeconds(value);

    const newDuration =
      (field === "hours" ? value : hours) * 3600 +
      (field === "minutes" ? value : minutes) * 60 +
      (field === "seconds" ? value : seconds);

    setFormData((prev) => ({ ...prev, countdownDuration: newDuration }));
  };

  // Handle alarm date/time changes
  const handleAlarmChange = (field: "date" | "time", value: string) => {
    if (field === "date") setAlarmDate(value);
    if (field === "time") setAlarmTime(value);

    const newDate = field === "date" ? value : alarmDate;
    const newTime = field === "time" ? value : alarmTime;

    if (newDate && newTime) {
      const dateTimeString = new Date(`${newDate}T${newTime}`).toISOString();
      setFormData((prev) => ({ ...prev, alarmTime: dateTimeString }));
    }
  };

  // Handle auto-repeat checkbox
  const handleAutoRepeatChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, isAutoRepeat: e.target.checked }));
  };

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(formData);
  };

  // Get today's date for min attribute
  const getToday = (): string => {
    const now = new Date();
    return now.toISOString().split("T")[0];
  };

  // Check if timer is active (for edit mode restrictions)
  const isTimerActive = initialData?.timerStatus !== "idle";

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="mb-4">
        <label htmlFor="title" className="block text-gray-700 font-medium mb-2">
          Task Title *
        </label>
        <input
          type="text"
          id="title"
          name="title"
          value={formData.title}
          onChange={handleInputChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>

      <div className="mb-4">
        <label
          htmlFor="description"
          className="block text-gray-700 font-medium mb-2"
        >
          Description (Optional)
        </label>
        <textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleInputChange}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="mb-4">
        <label
          htmlFor="timerType"
          className="block text-gray-700 font-medium mb-2"
        >
          Timer Type *
        </label>
        <select
          id="timerType"
          name="timerType"
          value={formData.timerType}
          onChange={handleTimerTypeChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={mode === "edit" && isTimerActive}
        >
          <option value={TimerType.COUNTDOWN}>Countdown Timer</option>
          <option value={TimerType.ALARM}>Alarm Timer</option>
        </select>
        {mode === "edit" && isTimerActive && (
          <p className="text-sm text-yellow-600 mt-1">
            Timer type cannot be changed for an active timer.
          </p>
        )}
      </div>

      {/* Timer specific fields */}
      {formData.timerType === TimerType.COUNTDOWN ? (
        <div className="mb-6">
          <label className="block text-gray-700 font-medium mb-2">
            Countdown Duration *
          </label>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="hours"
                className="block text-sm text-gray-600 mb-1"
              >
                Hours
              </label>
              <input
                type="number"
                id="hours"
                min="0"
                max="23"
                value={hours}
                onChange={(e) =>
                  handleTimeChange("hours", parseInt(e.target.value) || 0)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={mode === "edit" && isTimerActive}
              />
            </div>
            <div>
              <label
                htmlFor="minutes"
                className="block text-sm text-gray-600 mb-1"
              >
                Minutes
              </label>
              <input
                type="number"
                id="minutes"
                min="0"
                max="59"
                value={minutes}
                onChange={(e) =>
                  handleTimeChange("minutes", parseInt(e.target.value) || 0)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={mode === "edit" && isTimerActive}
              />
            </div>
            <div>
              <label
                htmlFor="seconds"
                className="block text-sm text-gray-600 mb-1"
              >
                Seconds
              </label>
              <input
                type="number"
                id="seconds"
                min="0"
                max="59"
                value={seconds}
                onChange={(e) =>
                  handleTimeChange("seconds", parseInt(e.target.value) || 0)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={mode === "edit" && isTimerActive}
              />
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            Total duration: {hours}h {minutes}m {seconds}s
          </p>
          {mode === "edit" && isTimerActive && (
            <p className="text-sm text-yellow-600 mt-1">
              Duration cannot be changed for an active timer.
            </p>
          )}
        </div>
      ) : (
        <div className="mb-6">
          <label className="block text-gray-700 font-medium mb-2">
            Alarm Date and Time *
          </label>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="alarmDate"
                className="block text-sm text-gray-600 mb-1"
              >
                Date
              </label>
              <input
                type="date"
                id="alarmDate"
                min={getToday()}
                value={alarmDate}
                onChange={(e) => handleAlarmChange("date", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required={formData.timerType === TimerType.ALARM}
                disabled={mode === "edit" && isTimerActive}
              />
            </div>
            <div>
              <label
                htmlFor="alarmTime"
                className="block text-sm text-gray-600 mb-1"
              >
                Time
              </label>
              <input
                type="time"
                id="alarmTime"
                value={alarmTime}
                onChange={(e) => handleAlarmChange("time", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required={formData.timerType === TimerType.ALARM}
                disabled={mode === "edit" && isTimerActive}
              />
            </div>
          </div>
          {mode === "edit" && isTimerActive && (
            <p className="text-sm text-yellow-600 mt-1">
              Alarm time cannot be changed for an active timer.
            </p>
          )}
        </div>
      )}

      {/* Auto-repeat checkbox */}
      <div className="mb-6">
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="isAutoRepeat"
            checked={formData.isAutoRepeat}
            onChange={handleAutoRepeatChange}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            disabled={mode === "edit" && isTimerActive}
          />
          <span className="text-gray-700 font-medium">
            Auto-repeat after completion
          </span>
        </label>
        <p className="text-sm text-gray-500 mt-1 ml-6">
          {formData.timerType === TimerType.COUNTDOWN
            ? "Timer will restart with the same duration after it completes"
            : "Alarm will be set for 24 hours later after it triggers"}
        </p>
        {mode === "edit" && isTimerActive && (
          <p className="text-sm text-yellow-600 mt-1 ml-6">
            Auto-repeat setting cannot be changed for an active timer.
          </p>
        )}
      </div>

      <div className="flex items-center justify-end space-x-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-blue-300"
        >
          {isLoading
            ? mode === "create"
              ? "Creating..."
              : "Saving..."
            : mode === "create"
              ? "Create Task"
              : "Save Changes"}
        </button>
      </div>
    </form>
  );
};

export default TaskForm;
