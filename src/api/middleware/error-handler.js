import {errorBody} from '../../utils/errors.js';export function errorHandler(err,req,res,_next){console.error(err);res.status(err.status||500).json(errorBody(err,req.requestId));}
