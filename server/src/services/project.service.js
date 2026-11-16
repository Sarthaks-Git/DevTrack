
import mongoose from 'mongoose';
import { deleteNotificationsForSubject } from './notification.service.js';
import Project from '../models/Project.js';
import Goal from '../models/Goal.js';
import JournalEntry from '../models/JournalEntry.js';
import AppError from '../utils/AppError.js';
import { assertBelowRecordLimit } from '../utils/recordLimits.js';
import { recordActivity } from './activity.service.js';
import { deleteProjectCommits } from './github.service.js';

const STATUS_LABELS = {
    planning: 'Planning',
    in_progress: 'In progress',
    completed: 'Completed',
    archived: 'Archived',
};

const ALLOWED_UPDATE_FIELDS = [
    'title',
    'description',
    'status',
    'priority',
    'technologies',
    'githubUrl',
    'liveUrl',
    'startDate',
    'endDate',
    'goal',
];

function normalizeProjectDates(data) {
    const normalized = { ...data };

    for (const field of ['startDate', 'endDate']) {
        if (
            typeof normalized[field] === 'string' &&
            normalized[field] !== ''
        ) {
            normalized[field] = new Date(
                `${normalized[field]}T00:00:00.000Z`
            );
        }
    }

    return normalized;
}

function validateDateRange(startDate, endDate) {
    if (
        startDate != null &&
        endDate != null &&
        new Date(endDate).getTime() < new Date(startDate).getTime()
    ) {
        throw new AppError(
            'End date cannot be earlier than start date',
            400
        );
    }
}

// A project may only point at one of its owner's own goals.
async function assertOwnedGoal(userId, goalId) {
    if (goalId && !(await Goal.exists({ _id: goalId, owner: userId }))) {
        throw new AppError('Linked goal was not found', 400, 'INVALID_LINK');
    }
}

function validateUserId(userId) {
    if (!mongoose.isValidObjectId(userId)) {
        throw new AppError('Unauthorized', 401);
    }
}

export async function createProjectLogic(userId, projectData) {
    validateUserId(userId);

    const safeData = normalizeProjectDates(projectData);

    validateDateRange(safeData.startDate, safeData.endDate);
    await assertOwnedGoal(userId, safeData.goal);

    await assertBelowRecordLimit(Project, userId, 'projects');

    const project = await Project.create({
        ...safeData,
        owner: userId,
    });

    await recordActivity(userId, {
        type: 'project_created',
        subjectType: 'project',
        subjectId: project._id,
        title: project.title,
        detail: STATUS_LABELS[project.status],
    });

    return project;
}

export async function getUserProjectsLogic(userId) {
    validateUserId(userId);

    return Project.find({ owner: userId })
        .sort({ createdAt: -1 });
}

export async function getSingleProjectLogic(userId, projectId) {
    validateUserId(userId);

    const project = await Project.findOne({
        _id: projectId,
        owner: userId,
    });

    if (!project) {
        throw new AppError('Project not found', 404);
    }

    return project;
}

export async function updateProjectLogic(
    userId,
    projectId,
    updateData
) {
    validateUserId(userId);

    const project = await Project.findOne({
        _id: projectId,
        owner: userId,
    });

    if (!project) {
        throw new AppError('Project not found', 404);
    }

    const safeUpdates = {};

    for (const field of ALLOWED_UPDATE_FIELDS) {
        if (updateData[field] !== undefined) {
            safeUpdates[field] = updateData[field];
        }
    }

    const normalizedUpdates = normalizeProjectDates(safeUpdates);

    const effectiveStartDate =
        normalizedUpdates.startDate !== undefined
            ? normalizedUpdates.startDate
            : project.startDate;

    const effectiveEndDate =
        normalizedUpdates.endDate !== undefined
            ? normalizedUpdates.endDate
            : project.endDate;

    validateDateRange(effectiveStartDate, effectiveEndDate);
    await assertOwnedGoal(userId, normalizedUpdates.goal);

    const previousStatus = project.status;

    Object.assign(project, normalizedUpdates);

    await project.save();

    if (project.status !== previousStatus) {
        await recordActivity(userId, {
            type: project.status === 'completed' ? 'project_completed' : 'project_status_changed',
            subjectType: 'project',
            subjectId: project._id,
            title: project.title,
            detail: `${STATUS_LABELS[previousStatus]} → ${STATUS_LABELS[project.status]}`,
        });
    }

    return project;
}

export async function deleteProjectLogic(userId, projectId) {
    validateUserId(userId);

    const project = await Project.findOneAndDelete({
        _id: projectId,
        owner: userId,
    });

    if (!project) {
        throw new AppError('Project not found', 404);
    }

    // Keep journal entries but drop their link to the deleted project; its reminders go with it.
    await Promise.all([
        JournalEntry.updateMany({ owner: userId, project: project._id }, { $set: { project: null } }),
        deleteNotificationsForSubject(userId, project._id),
        deleteProjectCommits(userId, project._id),
    ]);

    return project;
}
