
import {
    createProjectLogic,
    getUserProjectsLogic,
    getSingleProjectLogic,
    updateProjectLogic,
    deleteProjectLogic,
} from '../services/project.service.js';

export async function createProject(req, res) {
    const project = await createProjectLogic(req.user.id, req.body);

    return res.status(201).json({
        success: true,
        message: 'Project created successfully',
        data: { project },
    });
}

export async function getUserProjects(req, res) {
    const projects = await getUserProjectsLogic(req.user.id);

    return res.status(200).json({
        success: true,
        message: 'Projects retrieved successfully',
        data: { projects },
    });
}

export async function getSingleProject(req, res) {
    const project = await getSingleProjectLogic(
        req.user.id,
        req.params.id
    );

    return res.status(200).json({
        success: true,
        message: 'Project retrieved successfully',
        data: { project },
    });
}

export async function updateProject(req, res) {
    const project = await updateProjectLogic(
        req.user.id,
        req.params.id,
        req.body
    );

    return res.status(200).json({
        success: true,
        message: 'Project updated successfully',
        data: { project },
    });
}

export async function deleteProject(req, res) {
    await deleteProjectLogic(req.user.id, req.params.id);

    return res.status(200).json({
        success: true,
        message: 'Project deleted successfully',
        data: {},
    });
}
