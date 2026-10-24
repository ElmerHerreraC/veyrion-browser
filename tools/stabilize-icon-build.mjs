import fs from 'node:fs'
import path from 'node:path'

export function stabilizeIconBuild(source) {
  const file=path.resolve(source,'../components/vector_icons/aggregate_vector_icons.py')
  let text=fs.readFileSync(file,'utf8')
  if(text.includes('# Veyrion: retain unchanged declarations'))return
  if(!text.includes('  output_header = open(output_h, "w")')||!text.includes('  output_header.close()'))throw new Error('Revisar generador de iconos')
  text=text.replace('import glob','import glob\nimport io').replace('  output_header = open(output_h, "w")','  output_header = io.StringIO()').replace('  output_header.close()',`  # Veyrion: retain unchanged declarations when only icon artwork changes.
  header_text = output_header.getvalue()
  previous_header = None
  if os.path.exists(output_h):
    with open(output_h, "r") as previous_file:
      previous_header = previous_file.read()
  if previous_header != header_text:
    with open(output_h, "w") as header_file:
      header_file.write(header_text)
  output_header.close()`)
  fs.writeFileSync(file,text)
}
