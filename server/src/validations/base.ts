import { Diagnostic } from 'vscode-languageserver';

export class Validation<Type> {
	public text = '';
	public classAttributes = new Map<string, Set<string>>();
	constructor(public validations: ((element: Type, text: string, classAttributes: Map<string, Set<string>>) => Diagnostic | null)[]) { }
	init(text: string, classAttributes: Map<string, Set<string>>) {
		this.text = text;
		this.classAttributes = classAttributes;
	}
	run(element: Type): Diagnostic[] {
		if (!this.classAttributes || !this.text) {
			console.error("Failed to run the validation, are you sure it's initiated?");
			return [];
		}
		const text = this.text;
		const classAttributes = this.classAttributes;

		const diagnostics = this.validations.map(validation =>
			validation(element, text, classAttributes)
		);

		return diagnostics.filter(
			(d): d is Diagnostic => d !== null
		);
	};
}
