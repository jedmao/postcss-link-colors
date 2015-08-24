﻿///<reference path="../node_modules/postcss/postcss.d.ts" />
import postcss from 'postcss';

const errorContext = {
	plugin: 'postcss-all-link-colors'
};

const pseudoClassesPattern = /^(visited|focus|hover|active)$/;

// ReSharper disable once UnusedLocals
export default postcss.plugin('postcss-all-link-colors', () => {
	return root => {
		root.walkAtRules('link-colors', atRule => {
			const [all, inputColor, ...rest] = postcss.list.space(atRule.params);
			const isColorCloned = all === 'all';
			let color = inputColor;

			if (!isColorCloned) {
				if (color) {
					rest.unshift(color);
				}
				color = all;
			}

			if (!color) {
				throw atRule.error('Missing color parameter', errorContext);
			}

			if (rest.length) {
				throw atRule.error(`Too many parameters: ${rest.join(' ')}`, errorContext);
			}

			const colorDecl = postcss.decl({
				prop: 'color',
				value: color
			}).moveBefore(atRule);

			const overrides = {};
			let declarationCount = 0;
			let isFocusBeforeHover = true;
			atRule.walkDecls(pseudoClassesPattern, decl => {
				declarationCount++;
				if (/^(focus|hover)$/.test(decl.prop)) {
					isFocusBeforeHover = decl.prop === 'hover';
				}
				const rule = postcss.rule({
					selector: (<postcss.Rule>atRule.parent).selectors.map(selector => {
						return `${selector}:${decl.prop}`;
					}).join(', '),
					semicolon: atRule.raws.semicolon
				});
				decl.moveTo(rule);
				overrides[decl.prop] = rule;
				decl.prop = 'color';
			});

			atRule.walkDecls(decl => {
				throw decl.error(`Unsupported property: ${decl.prop}`, errorContext);
			});

			if (!isColorCloned && declarationCount === 0) {
				throw atRule.error(
					`Missing at-rule body. Did you mean @link-colors all ${color}?`,
					errorContext
				);
			}

			const pseudoClasses = ['visited']
				.concat(isFocusBeforeHover ? ['focus', 'hover'] : ['hover', 'focus'])
				.concat('active').reverse();
			pseudoClasses.forEach(pseudoClass => {
				const override = overrides[pseudoClass];
				if (override) {
					override.moveAfter(atRule.parent);
					return;
				}
				if (!isColorCloned) {
					return;
				}
				const rule = postcss.rule({
					selector: (<postcss.Rule>atRule.parent).selectors.map(selector => {
						return `${selector}:${pseudoClass}`;
					}).join(', '),
					semicolon: atRule.raws.semicolon
				});
				colorDecl.cloneAfter().moveTo(rule);
				rule.moveAfter(atRule.parent);
			});

			atRule.remove();
		});
	};
});
