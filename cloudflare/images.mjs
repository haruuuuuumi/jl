import {spawn} from 'node:child_process';
import {mkdir,stat} from 'node:fs/promises';
import {resolve} from 'node:path';

// Keep the encoder and its sharp version pinned without changing application dependencies.
// CLI syntax: https://github.com/vseventer/sharp-cli/tree/v5.2.0
const encoder='sharp-cli@5.2.0';
const widths=[480,960,1280];
const images=['little-things','together'];
const formats=[{name:'webp',quality:80},{name:'avif',quality:55}];

function runSharp(args,cwd){
  return new Promise((resolveRun,reject)=>{
    const npmCli=process.env.npm_execpath;
    const command=npmCli?process.execPath:'npm';
    const prefix=npmCli?[npmCli]:[];
    const child=spawn(command,[...prefix,'exec','--yes','--package='+encoder,'--','sharp',...args],{cwd,stdio:'inherit'});
    child.once('error',reject);
    child.once('close',(code,signal)=>{
      if(code===0)resolveRun();
      else reject(new Error(`Responsive image encoder failed (${signal||code}).`));
    });
  });
}

export async function buildResponsiveImages(root,out){
  const destination=resolve(out,'assets','assets','optimized');
  await mkdir(destination,{recursive:true});
  let count=0;
  for(const name of images){
    const source=resolve(root,'public','assets',name+'.png');
    const originalSize=(await stat(source)).size;
    console.log(`Responsive image source: assets/${name}.png ${originalSize} bytes`);
    for(const width of widths){
      for(const format of formats){
        const filename=`${name}-${width}.${format.name}`;
        const target=resolve(destination,filename);
        await runSharp(['--input',source,'--output',target,'--format',format.name,
          '--quality',String(format.quality),'--effort','4',
          'resize',String(width),'--withoutEnlargement'],root);
        const size=(await stat(target)).size;
        if(size===0||size>=originalSize)throw new Error('Responsive image must be nonempty and smaller than its PNG: '+filename);
        console.log(`Responsive image: assets/${filename} ${size} bytes (${(100*(1-size/originalSize)).toFixed(1)}% smaller than PNG)`);
        count++;
      }
    }
  }
  console.log(`Responsive images: ${count} optimized variants; original PNGs preserved.`);
}
