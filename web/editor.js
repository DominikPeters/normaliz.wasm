/**
 * CodeMirror 6 editor setup with Normaliz syntax highlighting.
 */
import {EditorView} from '@codemirror/view';
import {EditorState} from '@codemirror/state';
import {defaultKeymap, history, historyKeymap, indentWithTab} from '@codemirror/commands';
import {
    StreamLanguage,
    foldGutter,
    indentOnInput,
    bracketMatching,
    foldKeymap,
    syntaxTree,
} from '@codemirror/language';
import {
    lineNumbers,
    highlightActiveLineGutter,
    highlightSpecialChars,
    drawSelection,
    dropCursor,
    rectangularSelection,
    crosshairCursor,
    highlightActiveLine,
    keymap,
    Decoration,
    ViewPlugin,
} from '@codemirror/view';
import {tags} from '@lezer/highlight';
import {RangeSetBuilder} from '@codemirror/state';

// Equivalent to codemirror/basicSetup, without importing the umbrella package.
const basicSetup = [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightSpecialChars(),
    foldGutter(),
    drawSelection(),
    dropCursor(),
    EditorState.allowMultipleSelections.of(true),
    indentOnInput(),
    bracketMatching(),
    rectangularSelection(),
    crosshairCursor(),
    highlightActiveLine(),
    history(),
    keymap.of([
        { key: 'Mod-Enter', run: () => true },
        ...defaultKeymap,
        ...historyKeymap,
        indentWithTab,
        ...foldKeymap,
    ]),
];

// Normaliz input file keywords
const DIRECTIVE_KEYWORDS = new Set([
    'amb_space',
    'constraints', 'hom_constraints', 'write_lp_file',
    'number_field', 'min_poly', 'minpoly', 'embedding',
]);

const INPUT_KEYWORDS = new Set([
    // Generators
    'cone', 'polytope', 'monoid', 'vertices', 'offset', 'rational_offset',
    'normalization', 'integral_closure', 'polyhedron', 'rees_algebra', 'hyperplanes',
    'cone_and_lattice', 'lattice', 'rational_lattice', 'saturation',
    'subspace', 'open_facets',
    // Constraints
    'inequalities', 'inhom_inequalities', 'strict_inequalities',
    'equations', 'inhom_equations',
    'congruences', 'inhom_congruences',
    'signs', 'strict_signs',
    'excluded_faces', 'inhom_excluded_faces',
    'support_hyperplanes', 'extreme_rays',
    // Algebraic
    'lattice_ideal', 'toric_ideal', 'normal_toric_ideal',
    // Params
    'verbose', 'nonnegative', 'total_degree', 'convert_equations',
    'no_coord_transf', 'list_polynomials', 'no_pos_orth_def',
    'polynomial', 'polynomial_equations', 'polynomial_inequalities',
    'expansion_degree', 'nr_coeff_quasipol', 'face_codim_bound',
    'autom_codim_bound_vectors', 'block_size_hollow_tri', 'decimal_digits',
    'gb_degree_bound', 'gb_min_degree', 'modular_grading', 'chosen_fusion_ring',
    // Grading / accessory
    'grading', 'dehomogenization', 'gb_weight', 'scale',
    'projection_coordinates',
    // Fusion
    'fusion_type', 'fusion_type_for_partition',
    'fusion_duality', 'fusion_image_type', 'fusion_image_duality',
    'fusion_image_ring', 'fusion_ring_map', 'candidate_subring',
    // Add operations
    'add_cone', 'add_subspace', 'add_vertices',
    'add_inequalities', 'add_equations',
    'add_inhom_inequalities', 'add_inhom_equations',
    // Other
    'hilbert_basis_rec_cone', 'maximal_subspace',
    'generated_lattice',
]);

const PARAMETER_KEYWORDS = new Set([
    // Params
    'verbose', 'nonnegative', 'total_degree', 'convert_equations',
    'no_coord_transf', 'list_polynomials', 'no_pos_orth_def',
    'polynomial', 'polynomial_equations', 'polynomial_inequalities',
    'expansion_degree', 'nr_coeff_quasipol', 'face_codim_bound',
    'autom_codim_bound_vectors', 'block_size_hollow_tri', 'decimal_digits',
    'gb_degree_bound', 'gb_min_degree', 'modular_grading', 'chosen_fusion_ring',
]);

const KEYWORDS = new Set([
    // Computation directives in .in files
    'HilbertBasis', 'HilbertSeries', 'Deg1Elements', 'LatticePoints',
    'SupportHyperplanes', 'ExtremeRays', 'Triangulation',
    'Volume', 'Multiplicity', 'ModuleGenerators',
    'IsIntegrallyClosed', 'IsPointed', 'IsGorenstein',
    'ClassGroup', 'FaceLattice', 'FVector', 'DualFaceLattice', 'DualFVector',
    'FaceLatticeOrbits', 'FVectorOrbits', 'DualFaceLatticeOrbits', 'DualFVectorOrbits',
    'Incidence', 'DualIncidence', 'CombinatorialAutomorphisms',
    'PlacingTriangulation', 'PullingTriangulation', 'IsEmptySemiOpen',
    'Automorphisms', 'EhrhartSeries', 'StanleyDec',
    'MarkovBasis', 'GroebnerBasis', 'IntegerHull',
    'DualMode', 'Descent', 'Projection', 'Symmetrize',
    'LongLong', 'NoExtRaysOutput', 'BinomialsPacked',
    'NoHilbertBasisOutput', 'NoMatricesOutput', 'OutputOnInterrupt',
    'NoSuppHypsOutput', 'BigInt', 'KeepOrder', 'NoGradingDenom',
    'FusionRings', 'SimpleFusionRings',
    // Remaining ConeProperty goals / options
    'AffineDim', 'AllGeneratorsTriangulation', 'AmbientAutomorphisms',
    'Approximate', 'AxesScaling', 'BasicStanleyDec', 'BasicTriangulation',
    'BottomDecomposition', 'CodimSingularLocus', 'ConeDecomposition',
    'ConeForMonoid', 'CongOrderPatches', 'Congruences', 'CoveringFace',
    'DefaultMode', 'DegLex', 'Dehomogenization', 'DistributedComp',
    'DualFaceLatticeOrbits', 'Dynamic', 'EhrhartQuasiPolynomial',
    'EmbeddingDim', 'Equations', 'EuclideanAutomorphisms',
    'EuclideanIntegral', 'EuclideanVolume', 'ExcludedFaces',
    'ExploitAutomsVectors', 'ExploitIsosMult', 'ExternalIndex',
    'ExtremeRaysFloat', 'FixedPrecision', 'FullConeDynamic',
    'FusionData', 'GeneratorOfInterior', 'Generators', 'Grading', 'GradingDenom',
    'GradingIsPositive', 'HilbertQuasiPolynomial', 'InclusionExclusionData',
    'InductionMatrices', 'InputAutomorphisms', 'Integral', 'InternalIndex',
    'IsDeg1ExtremeRays', 'IsDeg1HilbertBasis', 'IsInhomogeneous',
    'IsLatticeIdealToric', 'IsReesPrimary', 'IsSerreR1',
    'IsTriangulationNested', 'IsTriangulationPartial', 'KeepOrder',
    'LatticePointTriangulation', 'Lex', 'LinearOrderPatches',
    'MaxDegRepresentations', 'MaximalSubspace', 'MinimizePolyEquations', 'ModularGradings',
    'ModuleGeneratorsOverOriginalMonoid', 'ModuleRank', 'NakedDual',
    'NoBottomDec', 'NoCoarseProjection', 'NoDescent', 'NoEmptyOutput',
    'NoHeuristicMinimization', 'NoLLL', 'NoNestedTri', 'NoPatching',
    'NoPeriodBound', 'NoProjection', 'NoQuasiPolynomial', 'NoRelax',
    'NoSignedDec', 'NoSubdivision', 'NoSymmetrization', 'NoWeights',
    'NonsimpleFusionRings', 'NumberLatticePoints', 'OnlyCyclotomicHilbSer',
    'OriginalMonoidGenerators', 'Patching', 'PrimalMode', 'ProjectCone', 'HSOP',
    'ProjectionFloat', 'PullingTriangulationInternal', 'Rank',
    'RationalAutomorphisms', 'RecessionRank', 'ReesPrimaryMultiplicity',
    'RenfVolume', 'Representations', 'RevLex', 'ShortInt', 'SignedDec',
    'SingleFusionRing', 'SingleLatticePoint', 'SingleLatticePointInternal',
    'SingularLocus', 'Static', 'StrictIsoTypeCheck', 'Sublattice',
    'SuppHypsFloat', 'SupportHyperplanes', 'Symmetrize',
    'TestArithOverflowDescent', 'TestArithOverflowDualMode',
    'TestArithOverflowFullCone', 'TestArithOverflowProjAndLift',
    'TestLargePyramids', 'TestLibNormaliz', 'TestLinearAlgebraGMP',
    'TestSimplexParallel', 'TestSmallPyramids', 'TriangulationDetSum',
    'TriangulationSize', 'UnimodularTriangulation', 'UnitGroupIndex',
    'UseModularGrading', 'UseWeightsPatching', 'VerticesFloat',
    'VerticesOfPolyhedron', 'VirtualMultiplicity', 'WeightedEhrhartQuasiPolynomial',
    'WeightedEhrhartSeries', 'WitnessNotIntegrallyClosed', 'WritePreComp',
]);

const normalizLanguage = StreamLanguage.define({
    tokenTable: {
        goal: [tags.keyword],
        input: [tags.keyword],
        directive: [tags.keyword],
        parameter: [tags.keyword],
        number: [tags.number],
        comment: [tags.comment],
    },
    startState() {
        return { inBlockComment: false };
    },
    token(stream, state) {
        // Comments are C-style block comments: /* ... */
        if (state.inBlockComment) {
            if (stream.skipTo('*/')) {
                stream.match('*/');
                state.inBlockComment = false;
            } else {
                stream.skipToEnd();
            }
            return 'comment';
        }
        if (stream.match('/*')) {
            state.inBlockComment = true;
            if (stream.skipTo('*/')) {
                stream.match('*/');
                state.inBlockComment = false;
            } else {
                stream.skipToEnd();
            }
            return 'comment';
        }
        // Numbers (possibly negative, possibly rational with /)
        if (stream.match(/-?\d+(\.\d+)?(\/\d+)?/)) return 'number';
        // Keywords
        if (stream.match(/[a-zA-Z_]\w*/)) {
            const word = stream.current();
            if (DIRECTIVE_KEYWORDS.has(word)) return 'directive';
            if (INPUT_KEYWORDS.has(word)) return 'input';
            if (PARAMETER_KEYWORDS.has(word)) return 'parameter';
            if (KEYWORDS.has(word)) return 'goal';
            return null;
        }
        stream.next();
        return null;
    },
});

const goalMark = Decoration.mark({ class: 'cm-nmz-keyword-goal' });
const inputMark = Decoration.mark({ class: 'cm-nmz-keyword-input' });
const directiveMark = Decoration.mark({ class: 'cm-nmz-keyword-directive' });
const parameterMark = Decoration.mark({ class: 'cm-nmz-keyword-parameter' });
const numberMark = Decoration.mark({ class: 'cm-nmz-number' });
const commentMark = Decoration.mark({ class: 'cm-nmz-comment' });

function buildTreeDecorations(view) {
    const builder = new RangeSetBuilder();
    const tree = syntaxTree(view.state);

    for (const { from, to } of view.visibleRanges) {
        tree.iterate({
            from,
            to,
            enter: (node) => {
                const name = node.type.name;
                if (name === 'goal') {
                    builder.add(node.from, node.to, goalMark);
                } else if (name === 'input') {
                    builder.add(node.from, node.to, inputMark);
                } else if (name === 'directive') {
                    builder.add(node.from, node.to, directiveMark);
                } else if (name === 'parameter') {
                    builder.add(node.from, node.to, parameterMark);
                } else if (name === 'number') {
                    builder.add(node.from, node.to, numberMark);
                } else if (name === 'comment') {
                    builder.add(node.from, node.to, commentMark);
                }
            },
        });
    }

    return builder.finish();
}

const treeHighlightPlugin = ViewPlugin.fromClass(class {
    constructor(view) {
        this.decorations = buildTreeDecorations(view);
    }

    update(update) {
        if (update.docChanged || update.viewportChanged) {
            this.decorations = buildTreeDecorations(update.view);
        }
    }
}, {
    decorations: (v) => v.decorations,
});

/**
 * Create a CodeMirror editor instance.
 * @param {HTMLElement} parent - container element
 * @param {string} [initialDoc] - initial content
 * @param {(view: EditorView) => void} [onChange] - callback on document changes
 * @returns {{ view: EditorView }}
 */
export function createEditor(parent, initialDoc = '', onChange = null) {
    const theme = EditorView.theme({
        '&': { height: '100%', fontSize: '14px' },
        '.cm-scroller': { overflow: 'auto' },
        '.cm-content': { fontFamily: 'monospace' },
        '.cm-nmz-keyword-goal': { color: '#5b21b6', fontWeight: '500' },
        '.cm-nmz-keyword-input': { color: '#0f766e', fontWeight: '500' },
        '.cm-nmz-keyword-directive': { color: '#9a3412', fontWeight: '500' },
        '.cm-nmz-keyword-parameter': { color: '#7c3aed', fontWeight: '500' },
        '.cm-nmz-number': { color: '#b45309' },
        '.cm-nmz-comment': { color: '#6b7280', fontStyle: 'italic' },
    });

    const view = new EditorView({
        state: EditorState.create({
            doc: initialDoc,
            extensions: [
                basicSetup,
                normalizLanguage,
                treeHighlightPlugin,
                ...(onChange ? [EditorView.updateListener.of((update) => {
                    if (update.docChanged) onChange(update.view);
                })] : []),
                theme,
            ],
        }),
        parent,
    });

    return { view };
}

/**
 * Get editor content.
 */
export function getContent(view) {
    return view.state.doc.toString();
}

/**
 * Set editor content.
 */
export function setContent(view, text) {
    view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: text },
    });
}
