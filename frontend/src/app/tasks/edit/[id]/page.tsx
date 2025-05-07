// frontend/src/app/tasks/edit/[id]/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { UpdateTaskDto, TimerType, Task } from "@/types/task";
import { taskAPI } from "@/services/api";
import AppLayout from "@/components/layout/AppLayout";
import TaskForm from "@/components/tasks/TaskForm";

interface PageProps {
  params: {
    id: string;
  };
}

const EditTaskPage = ({ params }: PageProps) => {
  const router = useRouter();
  const [task, setTask] = useState<Task | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch task data
  useEffect(() => {
    const fetchTask = async () => {
      setIsLoading(true);
      try {
        const taskData = await taskAPI.getTask(params.id);
        setTask(taskData);
      } catch (err) {
        setError("Failed to fetch task. Please try again.");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTask();
  }, [params.id]);

  const handleSubmit = async (formData: UpdateTaskDto) => {
    setIsSaving(true);
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
      await taskAPI.updateTask(params.id, formData);
      router.push("/tasks");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update task");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </AppLayout>
    );
  }

  if (!task) {
    return (
      <AppLayout>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error || "Task not found"}
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Edit Task</h1>

        <TaskForm
          mode="edit"
          initialData={task}
          onSubmit={handleSubmit}
          isLoading={isSaving}
          error={error}
          onCancel={() => router.push("/tasks")}
        />
      </div>
    </AppLayout>
  );
};

export default EditTaskPage;
