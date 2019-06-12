import {
    GET_FLOWS, UPDATE_FLOW, UPDATE_FLOW_ERROR, GET_FLOWS_PAGE,
} from '../action/flows';

const initialState = {
    all: [],
    error: null,
    meta: null,
};

export default (state = initialState, action) => {
    switch (action.type) {
    case GET_FLOWS:
        return {
            ...state,
            error: null,
            all: [
                ...action.flows,
            ],
            meta: { ...action.meta },
        };
    case GET_FLOWS_PAGE:
        return {
            ...state,
            error: null,
            all: [
                ...action.flows,
            ],
            meta: { ...action.meta },
        };
    case UPDATE_FLOW:
        return {
            ...state,
            error: null,
        };
    case UPDATE_FLOW_ERROR:
        return {
            ...state,
            error: action.err,
        };
    default:
        return state;
    }
};
