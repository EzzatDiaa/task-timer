// frontend/src/app/tasks/create/page.tsx
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { CreateTaskDto, TimerType, UpdateTaskDto } from "@/types/task";
import { taskAPI } from "@/services/api";
import AppLayout from "@/components/layout/AppLayout";
import TaskForm from "@/components/tasks/TaskForm";

const CreateTaskPage = () => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (formData: CreateTaskDto | UpdateTaskDto) => {
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

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">
          Create New Task
        </h1>

        <TaskForm
          mode="create"
          onSubmit={handleSubmit}
          isLoading={isLoading}
          error={error}
          onCancel={() => router.push("/tasks")}
        />
      </div>
    </AppLayout>
  );
};

export default CreateTaskPage;
