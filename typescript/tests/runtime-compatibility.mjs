import assert from 'node:assert/strict';
import {
    END_NODE_ID,
    TREESPEC_WIRE_VERSION,
    compileTreeSpec,
    decompileTreeSpec,
    lintTreeSpecGraph,
    parseTreeSpecWire,
    safeUUID,
} from '@signalsafe/tree-spec';

// This file is copied into an external consumer to exercise the installed tarball.
const wire = {
    wire_version: TREESPEC_WIRE_VERSION,
    start_node: 'start',
    nodes: {
        start: {
            type: 'prompt',
            prompt: 'Choose',
            choices: [{ id: 'go', label: 'Continue', feedback: { title: 'Good' } }],
        },
    },
    transitions: [{
        from: ['start', 'go'],
        to: END_NODE_ID,
        outcome: 'safe',
        delta: { score: 1 },
        feedback: { title: 'Finished' },
        lessons_triggered: ['lesson'],
    }],
};
const parsed = parseTreeSpecWire(JSON.parse(JSON.stringify(wire)));
assert.ok(parsed.value, JSON.stringify(parsed.issues));
assert.deepEqual(parsed.issues, []);
assert.deepEqual(lintTreeSpecGraph(parsed.value), []);
const graph = decompileTreeSpec(parsed.value);
assert.equal(graph.transitions[0].toNodeId, END_NODE_ID);
const roundTrip = compileTreeSpec(graph);
assert.deepEqual(roundTrip.transitions, wire.transitions);
assert.deepEqual(roundTrip.nodes.start.choices, wire.nodes.start.choices);
assert.ok(parseTreeSpecWire(roundTrip).value);

const invalid = parseTreeSpecWire({ ...wire, start_node: 'missing' });
assert.equal(invalid.value, null);
assert.ok(invalid.issues.some(issue => issue.severity === 'error'));
assert.equal(parseTreeSpecWire(null).value, null);

const legacy = decompileTreeSpec({
    ...wire,
    transitions: [{ from: ['start', 'go'], to: '__END__', outcome: 'safe' }],
});
assert.equal(legacy.transitions[0].toNodeId, END_NODE_ID);
assert.match(safeUUID(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
console.log(`Packed runtime compatibility passed on ${process.version}`);
