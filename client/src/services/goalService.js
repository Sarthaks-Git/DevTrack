// Only responsible for communicating with:

// GET    /api/goals
// POST   /api/goals
// PATCH  /api/goals/:id
// DELETE /api/goals/:id

// It should not contain UI logic.


const API_URL = 'http://localhost:5000/api/goals';

async function handleResponse(response) {
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || 'Something went wrong');
    }

    return data;
}

export async function getGoals() {
    const response = await fetch(API_URL, {
        method: 'GET',
        credentials: 'include'
    });

    return handleResponse(response);
}

export async function createGoal(goalData) {
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(goalData)
    });

    return handleResponse(response);
}

export async function updateGoal(goalId, goalData) {
    const response = await fetch(`${API_URL}/${goalId}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(goalData)
    });

    return handleResponse(response);
}

export async function deleteGoal(goalId) {
    const response = await fetch(`${API_URL}/${goalId}`, {
        method: 'DELETE',
        credentials: 'include'
    });

    return handleResponse(response);
}
