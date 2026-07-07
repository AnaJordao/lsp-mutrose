import { Validation } from './base';
import { GmNode } from '../interfaces';
export const goalValidation = (text: string, classAttributes: Map<string, Set<string>>) => {
	const validation = new Validation<GmNode>([]);
	validation.init(text, classAttributes);
	return validation;
};
