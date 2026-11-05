import test from 'node:test';
import assert from 'node:assert/strict';
import {DirectorError,diagnostic} from '../src/errors.js';
import {schemas} from '../src/schema.generated.js';
import {schemaErrors} from '../src/schema.js';
test('internal subsystem labels normalize to the canonical diagnostic contract',()=>{
  for(const phase of ['runtime','agent','checkpoint','react','surface','playback','parse','compile','prepare','policy','integration','validation','unknown']){
    const value=new DirectorError('TEST_ERROR','A value-redacted error.',phase).diagnostic;
    assert.deepEqual(schemaErrors(value,schemas.diagnostic,schemas),[],phase);
    assert.equal(Object.isFrozen(value.recoveries),true);
  }
});
test('generic host errors remain redacted and schema-valid',()=>{
  const value=diagnostic(new Error('PRIVATE_HOST_VALUE'),'agent');
  assert.equal(value.phase,'policy');assert.equal(JSON.stringify(value).includes('PRIVATE_HOST_VALUE'),false);
  assert.deepEqual(schemaErrors(value,schemas.diagnostic,schemas),[]);
});
