export const passwordHint='12 a 128 caracteres, con mayúscula, minúscula, número y símbolo.';
export function passwordError(value:string,confirmation:string):string {
 if(value.length<12||value.length>128)return 'La contraseña debe tener entre 12 y 128 caracteres.';
 if(/[\u0000-\u001f\u007f]/u.test(value)||!/\p{Lu}/u.test(value)||!/\p{Ll}/u.test(value)||!/[0-9]/u.test(value)||!/[^\p{L}\p{N}\s]/u.test(value))return 'Incluye una mayúscula, una minúscula, un número y un símbolo.';
 return value!==confirmation?'Las contraseñas no coinciden.':'';
}
export const passwordPattern='(?=.*\\p{Lu})(?=.*\\p{Ll})(?=.*[0-9])(?=.*[^\\p{L}\\p{N}\\s])[^\\x00-\\x1F\\x7F]{12,128}';
