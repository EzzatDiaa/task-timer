"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { CreateTaskDto, TimerType } from "@/types/task";
import { taskAPI } from "@/services/api";
import AppLayout from "@/components/layout/AppLayout";

const CreateTaskPage = () => {
  const router = useRouter();
  const [formData, setFormData] = useState<CreateTaskDto>({
    title: "",
    description: "",
    timerType: TimerType.COUNTDOWN,
    countdownDuration: 1800, // Default 30 minutes
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // For time picker UI (countdown timer)
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(30);
  const [seconds, setSeconds] = useState(0);

  // For date picker UI (alarm timer)
  const [alarmDate, setAlarmDate] = useState("");
  const [alarmTime, setAlarmTime] = useState("");

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

    // Reset appropriate fields based on timer type
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

    // Update countdownDuration in formData
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

    // Update alarmTime in formData if both date and time are set
    const newDate = field === "date" ? value : alarmDate;
    const newTime = field === "time" ? value : alarmTime;

    if (newDate && newTime) {
      const dateTimeString = new Date(`${newDate}T${newTime}`).toISOString();
      setFormData((prev) => ({ ...prev, alarmTime: dateTimeString }));
    }
  };

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Validate form based on timer type
      if (formData.timerType === TimerType.COUNTDOWN) {
        if (!formData.countdownDuration || formData.countdownDuration <= 0) {
          throw new Error("Please set a valid countdown duration");
        }
      } else if (formData.timerType === TimerType.ALARM) {
        if (!formData.alarmTime) {
          throw new Error("Please set a valid alarm time");
        }

        const alarmDate = new Date(formData.alarmTime);
        if (alarmDate <= new Date()) {
          throw new Error("Alarm time must be in the future");
        }
      }

      // Submit form
      await taskAPI.createTask(formData);
      router.push("/tasks");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task");
    } finally {
      setIsLoading(false);
    }
  };

  // Get today's date in YYYY-MM-DD format for min attribute of date input
  const getToday = (): string => {
    const now = new Date();
    return now.toISOString().split("T")[0];
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">
          Create New Task
        </h1>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label
              htmlFor="title"
              className="block text-gray-700 font-medium mb-2"
            >
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
            >
              <option value={TimerType.COUNTDOWN}>Countdown Timer</option>
              <option value={TimerType.ALARM}>Alarm Timer</option>
            </select>
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
                  />
                </div>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                Total duration: {hours}h {minutes}m {seconds}s
              </p>
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
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end space-x-4">
            <button
              type="button"
              onClick={() => router.push("/tasks")}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-blue-300"
            >
              {isLoading ? "Creating..." : "Create Task"}
            </button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
};
export default CreateTaskPage;
