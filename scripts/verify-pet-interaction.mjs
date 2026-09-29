import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const b=await chromium.launch({channel:'msedge',headless:true});
try {
const p=await b.newPage({viewport:{width:1280,height:1000}});
await p.goto('http://127.0.0.1:4188/#/market/pet-mooncat');
const pet=p.locator('.pet-playground-pet');await pet.waitFor();await pet.scrollIntoViewIfNeeded();
const box=await pet.boundingBox();
await p.mouse.move(box.x+20,box.y+30);await p.mouse.down();await p.mouse.move(box.x+40,box.y+45);
const after=await pet.boundingBox();assert.ok(Math.abs(after.x-box.x-20)<2&&Math.abs(after.y-box.y-15)<2);
const active=()=>p.locator('.pet-playground-controls [aria-pressed=true]').innerText();
assert.equal(await active(),'提起');await p.waitForTimeout(500);assert.equal(await active(),'拖动');
await p.mouse.up();assert.equal(await active(),'放下');
await p.waitForTimeout(600);
await pet.focus();await p.keyboard.press('Enter');
assert.equal(await active(),'戳一下');
await p.getByRole('button',{name:'保存反应',exact:true}).click();assert.equal(await active(),'保存反应');
console.log('PASS: drag offset, start, dragging, end, keyboard click, save event');
} finally {await b.close()}
