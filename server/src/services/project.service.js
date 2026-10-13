
import mongoose from 'mongoose';
import Project from '../models/Project.js';
import AppError from '../utils/AppError.js';

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

function validateUserId(userId) {
    if (!mongoose.isValidObjectId(userId)) {
        throw new AppError('Unauthorized', 401);
    }
}

export async function createProjectLogic(userId, projectData) {
    validateUserId(userId);

    const safeData = normalizeProjectDates(projectData);

    validateDateRange(safeData.startDate, safeData.endDate);

    const project = await Project.create({
        ...safeData,
        owner: userId,
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

    Object.assign(project, normalizedUpdates);

    await project.save();

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

    return project;
}
