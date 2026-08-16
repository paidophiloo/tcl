import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [ui, css, index, processing, runtime] = await Promise.all([
  readFile(new URL('../src/career-manager-job-centre.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/career-manager-job-centre.css', import.meta.url), 'utf8'),
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../src/career-home-processing.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/career-core/career-runtime.js', import.meta.url), 'utf8')
]);

assert.match(index, /career-session-persistence\.js[\s\S]*career-manager-job-centre\.js/, 'Job Centre must mount after persistence state is available');
assert.match(ui, /managerJobMarketSnapshot\(career, career\.currentDate\)/, 'visible vacancies must come from persisted manager-market state');
assert.match(ui, /applyForManagerJob\(career/, 'Job Centre must submit real manager applications');
assert.match(ui, /acceptManagerJob\(career/, 'club control must return only through an accepted job offer');
assert.match(ui, /advanceOneDay\(career\)/, 'unemployed career must continue advancing the same living world day by day');
assert.match(ui, /career\.managerCareer\?\.status !== 'unemployed'/, 'day advancement must stop if the manager becomes employed');
assert.match(ui, /ensureLegacyCareerPointer\(\)/, 'employment transitions must keep legacy routing aligned with the durable save');
assert.match(ui, /Clubes só aparecem aqui quando existe uma vaga real no Living World/, 'UI must explain that vacancies are not scripted for the player');
assert.doesNotMatch(ui, /Math\.random|fake|mock/i, 'Job Centre must not fabricate openings or decisions');
assert.match(css, /\.jm-vacancy-list/);
assert.match(css, /\.jm-processing/);
assert.match(processing, /preview\.status==='unemployed'/, 'calendar preview must stop as soon as dismissal changes employment state');
assert.match(processing, /CareerRepository\.save\(preview\)/, 'dismissal reached during preview must persist the exact deterministic preview state instead of continuing to a nonexistent user fixture');
assert.match(runtime, /const unemployedBeforeTick = managerIsUnemployed\(career\)/, 'runtime must know whether unemployment existed before the current world tick');
assert.match(runtime, /if \(!unemployedBeforeTick && unemployedAfterTick\)/, 'only the employed-to-unemployed transition may freeze the calendar');
assert.match(runtime, /employmentChangeDate: processingDate/, 'dismissal transition must preserve the exact decision date');
assert.match(runtime, /if \(!unemployedAfterTick\) recover\(career\)/, 'an unemployed manager must not keep recovering the former club player state');
assert.match(runtime, /career\.currentDate = nextDay\(processingDate\)/, 'once already unemployed, advancing the Job Centre must continue the living calendar normally');
assert.match(runtime, /step\.ready \|\| career\.status === 'complete' \|\| step\.employmentChanged/, 'continue-to-next-match guard must stop on dismissal instead of searching forever for a user fixture');

console.log('career manager job centre smoke: ok');
