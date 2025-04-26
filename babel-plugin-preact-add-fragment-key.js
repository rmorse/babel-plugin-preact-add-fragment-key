const { declare } = require('@babel/helper-plugin-utils');
const t = require('@babel/types');
const { addNamed } = require('@babel/helper-module-imports');

/**
 * This plugin is used to add a key attribute to all top level <Fragment>
 * elements in a Preact component.
 * 
 * This is to workaround a bug with Preact & Prefresh where updates in nested fragments
 * are not triggering HMR properly.
 * 
 * This plugin:
 * - finds any top level JSX Fragments in a components return (ie when a component returns <>...</>)
 * - if the fragment doesn't already have a key, adds a key attribute
 * - supports functional components only
 * 
 * @see https://github.com/preactjs/prefresh/issues/569
 */

module.exports = declare((api) => {
  api.assertVersion(7);

  const fileStateMap = new WeakMap();

  function getFileState(file) {
    if (!fileStateMap.has(file)) {
      fileStateMap.set(file, {
        filename: file.opts.filename || 'unknown_file',
        keyCounter: 0,
      });
    }
    return fileStateMap.get(file);
  }

  return {
    name: 'add-fragment-key',
    visitor: {
      Program: {
        enter(path, state) {
          // Initialize state for the file
          getFileState(state.file);
        },
      },
      FunctionDeclaration(path, state) {
        const componentName = path.node.id ? path.node.id.name : 'AnonymousFunctionDeclaration';
        processComponent(path, componentName, state.file);
      },
      FunctionExpression(path, state) {
        const componentName = path.parentPath.isVariableDeclarator() && path.parentPath.node.id.type === 'Identifier'
          ? path.parentPath.node.id.name
          : 'AnonymousFunctionExpression';
        processComponent(path, componentName, state.file);
      },
      ArrowFunctionExpression(path, state) {
        const file = state.file;
        const componentName = path.parentPath.isVariableDeclarator() && path.parentPath.node.id.type === 'Identifier'
          ? path.parentPath.node.id.name
          : 'AnonymousArrowFunction';

        if (t.isJSXElement(path.node.body) || t.isJSXFragment(path.node.body)) {
          addKeyToFragmentIfNeeded(path.get('body'), componentName, file);
        } else {
          processComponent(path, componentName, file);
        }
      },
    },
  };

  function processComponent(path, componentName, file) {
    const currentState = getFileState(file);
    path.traverse({
      ReturnStatement(returnPath) {
        if (returnPath.getFunctionParent() !== path) {
          return;
        }
        const argumentPath = returnPath.get('argument');
        if (argumentPath.node) {
          addKeyToFragmentIfNeeded(argumentPath, componentName, file);
        }
      },
    }, {
      fileState: currentState
    });
  }

  function addKeyToFragmentIfNeeded(jsxPath, componentName, file) {
    const currentState = getFileState(file);

    if (!jsxPath || !jsxPath.node || (!t.isJSXElement(jsxPath.node) && !t.isJSXFragment(jsxPath.node))) {
      return;
    }

    if (t.isJSXFragment(jsxPath.node)) {
      // Handle <>...</>
      const newKey = `${componentName}_frag_${currentState.keyCounter++}`;
      const keyAttribute = t.jsxAttribute(
        t.jsxIdentifier('key'),
        t.stringLiteral(newKey)
      );

      const fragmentIdentifier = addNamed(jsxPath, 'Fragment', 'preact/jsx-runtime', { nameHint: 'Fragment' });

      const replacementNode = t.jsxElement(
        t.jsxOpeningElement(t.jsxIdentifier(fragmentIdentifier.name), [keyAttribute], false),
        t.jsxClosingElement(t.jsxIdentifier(fragmentIdentifier.name)),
        jsxPath.node.children || [],
        false
      );

      jsxPath.replaceWith(replacementNode);

    } else if (t.isJSXElement(jsxPath.node) && t.isJSXOpeningElement(jsxPath.node.openingElement) && t.isJSXIdentifier(jsxPath.node.openingElement.name, { name: 'Fragment' })) {
      // Handle explicit <Fragment>...</Fragment>
      const openingElementPath = jsxPath.get('openingElement');
      const attributes = openingElementPath.node.attributes || [];
      const hasKey = attributes.some(
        (attr) => t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name, { name: 'key' })
      );

      if (!hasKey) {
        const newKey = `${componentName}_frag_${currentState.keyCounter++}`;
        const keyAttribute = t.jsxAttribute(
          t.jsxIdentifier('key'),
          t.stringLiteral(newKey)
        );

        if (!openingElementPath.node.attributes) {
          openingElementPath.node.attributes = [];
        }
        openingElementPath.node.attributes.push(keyAttribute);

        if (!jsxPath.node.closingElement) {
          jsxPath.node.closingElement = t.jsxClosingElement(t.jsxIdentifier('Fragment'));
        }
      }
    } else {
      return;
    }
  }
}); 