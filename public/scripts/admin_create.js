// document.addEventListener('DOMContentLoaded', async () => {
//   // Obtener datos del usuario logueado
//   let usuario;
//   try {
//     const res = await fetch('/api/login/me', { credentials: 'include' });
//     if (!res.ok) throw new Error('No logueado');
//     usuario = await res.json();
//   } catch {
//     alert('No ha iniciado sesión correctamente.');
//     window.location.href = "/";
//     return;
//   }
// });

// Función para cargar roles dinámicamente en un select
async function cargarRoles(selectElement, selectedRol = '') {
  try {
    const res = await fetch('/api/usuarios/roles');
    if (!res.ok) throw new Error('Error al cargar roles');
    const roles = await res.json(); // debe ser array de strings ["secretaria", "docente", ...]

    // Limpiar opciones previas (excepto el primer option)
    const primerOption = selectElement.querySelector('option');
    selectElement.innerHTML = '';
    if (primerOption) selectElement.appendChild(primerOption);

    roles.forEach(rol => {
      const option = document.createElement('option');
      option.value = rol;
      option.textContent = rol.charAt(0).toUpperCase() + rol.slice(1);
      if (rol === selectedRol) option.selected = true;
      selectElement.appendChild(option);
    });
  } catch (err) {
    console.error(err);
  }
}

// Cargar roles en el select de registro al cargar la página
document.addEventListener('DOMContentLoaded', () => {
  cargarRoles(document.getElementById('rol'));
  // El select de actualización se llenará dinámicamente al buscar usuario (ver más abajo)
});

//verificar cedula y autocompletar nombre y apellido con api de web services
const cedulaInput = document.getElementById('cedula');
const nombreInput = document.getElementById('nombre');
const apellidoInput = document.getElementById('apellido');
const cedulaMensaje = document.getElementById('cedulaMensaje');


async function consultarCedula(cedula) {
  cedulaMensaje.textContent = "";
  cedulaMensaje.className = "cedula-mensaje";
  nombreInput.value = "";
  apellidoInput.value = "";

  if (cedula.length !== 10) {
    cedulaMensaje.textContent = "La cédula debe tener 10 dígitos.";
    cedulaMensaje.classList.add("error");
    return;
  }

  try {
    const res = await fetch(`/api/usuarios/verificacion/${cedula}`);

    if (!res.ok) throw new Error();

    const data = await res.json();
    const persona = data?.data?.response;

    if (persona?.nombres && persona?.apellidos) {
      nombreInput.value = persona.nombres;
      apellidoInput.value = persona.apellidos;

      cedulaMensaje.textContent = "Cédula encontrada. Datos cargados";
      cedulaMensaje.classList.add("ok");
    } else {
      cedulaMensaje.textContent = "No se encontraron datos.";
      cedulaMensaje.classList.add("error");
    }
  } catch (error) {
    cedulaMensaje.textContent = "Cédula no existe o no se pudo consultar.";
    cedulaMensaje.classList.add("error");
  }
}

cedulaInput.addEventListener("change", () => {
  const ced = cedulaInput.value.trim();
  if (ced) consultarCedula(ced);
});



//verificar numero de whatsapp con web services
// const telefonoInput = document.getElementById("telefono");
// const telefonoMensaje = document.getElementById("telefonoMensaje");

// async function validarWhatsApp(telefono) {
//   telefonoMensaje.textContent = "";
//   telefonoMensaje.className = "telefono-mensaje";

//   // Validar formato básico
//   if (!/^[0][0-9]{9}$/.test(telefono)) {
//     telefonoMensaje.textContent = "Número inválido. Debe comenzar con 0 y tener 10 dígitos.";
//     telefonoMensaje.classList.add("error");
//     return;
//   }

//   // Convertir a formato internacional
//   const telefonoInternacional = "593" + telefono.substring(1);

//   console.log("Consultando:", telefonoInternacional);

//   try {
//     const headers = new Headers();
//     headers.append("Authorization", "Bearer TOKEN");
//     headers.append("Accept", "application/json");

//     const res = await fetch(`/api/usuarios/verificacion-whatsapp/${telefonoInternacional}`, {
//       method: "GET",
//       headers
//     });

//     if (!res.ok) throw new Error();

//     const data = await res.json();

//     const info = data?.data;
//     const existe = info?.is_valid === true && info?.status === "available";

//     if (existe) {
//       telefonoMensaje.textContent = "Este número SÍ tiene WhatsApp";
//       telefonoMensaje.classList.add("ok");
//     } else {
//       telefonoMensaje.textContent = "Este número NO tiene WhatsApp";
//       telefonoMensaje.classList.add("error");
//     }

//   } catch (err) {
//     console.error(err);
//     telefonoMensaje.textContent = "Error al verificar el número.";
//     telefonoMensaje.classList.add("error");
//   }
// }

// // Dispara validación cuando termine de escribir el número
// telefonoInput.addEventListener("change", () => {
//   const tel = telefonoInput.value.trim();
//   if (tel) validarWhatsApp(tel);
// });


//verificar numero de whatsapp con apiconsult
const telefonoInput = document.getElementById("telefono");
const telefonoMensaje = document.getElementById("telefonoMensaje");

async function validarWhatsApp(telefono) {
  telefonoMensaje.textContent = "";
  telefonoMensaje.className = "telefono-mensaje";

  // Validar que tenga 10 dígitos y empiece con 0
  if (!/^0\d{9}$/.test(telefono)) {
    telefonoMensaje.textContent = "Número inválido. Debe comenzar con 0 y tener 10 dígitos.";
    telefonoMensaje.classList.add("error");
    return;
  }

  try {
    const res = await fetch(`/api/usuarios/verificacion-whatsapp/${telefono}`);

    if (!res.ok) throw new Error("Error en verificación");

    const data = await res.json();

    const existe = data?.existe === true;

    if (existe) {
      telefonoMensaje.textContent = "Este número SÍ tiene WhatsApp";
      telefonoMensaje.classList.add("ok");
    } else {
      telefonoMensaje.textContent = "Este número NO tiene WhatsApp";
      telefonoMensaje.classList.add("error");
    }
  } catch (e) {
    console.error(e);
    telefonoMensaje.textContent = "Error al verificar el número.";
    telefonoMensaje.classList.add("error");
  }
}

telefonoInput.addEventListener("change", () => {
  const tel = telefonoInput.value.trim();
  if (tel) validarWhatsApp(tel);
});

// Gestión de verificación por SMS usando Twilio Verify
// const telefonoInput = document.getElementById("telefono");
// const telefonoMensaje = document.getElementById("telefonoMensaje");
// const btnEnviarCodigo = document.getElementById("btnEnviarCodigo");

// let telefonoVerificado = false;
// let telefonoUsadoParaOTP = null;

// // Función para mostrar el modal y verificar el código
// async function pedirCodigoEnModal(telefono) {
//   const { value: codigo } = await Swal.fire({
//     title: 'Ingresa el código SMS',
//     text: `Hemos enviado un código al número ${telefono}.`,
//     input: 'text',
//     inputLabel: 'Código de verificación',
//     inputPlaceholder: 'Ej: 123456',
//     inputAttributes: {
//       maxlength: '6',
//       autocapitalize: 'off',
//       autocorrect: 'off'
//     },
//     showCancelButton: true,
//     confirmButtonText: 'Verificar',
//     cancelButtonText: 'Cancelar'
//   });

//   // Si cierra el modal o no escribe nada, no hacemos nada
//   if (!codigo) return;

//   try {
//     const res = await fetch("/api/twilio/verificar", {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ telefono, codigo })
//     });

//     const data = await res.json();

//     if (res.ok && data.success) {
//       telefonoVerificado = true;
//       telefonoUsadoParaOTP = telefono;

//       await Swal.fire({
//         icon: 'success',
//         title: 'Teléfono verificado',
//         text: 'El código es correcto. Puedes continuar con el registro.'
//       });
//     } else {
//       telefonoVerificado = false;
//       await Swal.fire({
//         icon: 'error',
//         title: 'Código incorrecto',
//         text: data.message || 'El código es incorrecto o ha expirado.'
//       });
//     }
//   } catch (err) {
//     console.error(err);
//     telefonoVerificado = false;
//     await Swal.fire({
//       icon: 'error',
//       title: 'Error',
//       text: 'Error al verificar el código.'
//     });
//   }
// }

// // Enviar código SMS
// btnEnviarCodigo.addEventListener("click", async () => {
//   telefonoMensaje.textContent = "";
//   telefonoMensaje.className = "telefono-mensaje";
//   telefonoVerificado = false;
//   telefonoUsadoParaOTP = null;

//   const telefono = telefonoInput.value.trim(); // formato local: 0XXXXXXXXX

//   // Validar formato 0XXXXXXXXX
//   if (!/^0\d{9}$/.test(telefono)) {
//     telefonoMensaje.textContent = "Número inválido. Debe comenzar con 0 y tener 10 dígitos.";
//     telefonoMensaje.classList.add("error");
//     return;
//   }

//   try {
//     btnEnviarCodigo.disabled = true;
//     btnEnviarCodigo.textContent = "Enviando...";

//     const res = await fetch("/api/twilio/enviar", {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ telefono })
//     });

//     const data = await res.json();

//     if (res.ok && data.success) {
//       telefonoMensaje.textContent = "Código enviado por SMS. Revisa tu teléfono.";
//       telefonoMensaje.classList.add("ok");

//       // Abrimos el modal para que escriba el código
//       await pedirCodigoEnModal(telefono);
//     } else {
//       telefonoMensaje.textContent = data.error || "No se pudo enviar el código.";
//       telefonoMensaje.classList.add("error");
//     }
//   } catch (err) {
//     console.error(err);
//     telefonoMensaje.textContent = "Error al enviar el código.";
//     telefonoMensaje.classList.add("error");
//   } finally {
//     btnEnviarCodigo.disabled = false;
//     btnEnviarCodigo.textContent = "Enviar código SMS";
//   }
// });

//verificar correo
const correoInput = document.getElementById("correo");
const correoMensaje = document.getElementById("correoMensaje");

let correoValido = false;

async function verificarCorreo(correo) {
  correoMensaje.textContent = "";
  correoMensaje.className = "correo-mensaje";

  // ✅ Validación rápida en frontend
  const regexEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!regexEmail.test(correo)) {
    correoMensaje.textContent = "Formato de correo inválido";
    correoMensaje.classList.add("error");
    correoValido = false;
    return;
  }

  try {
    const res = await fetch(`/api/usuarios/verificacion-email/${correo}`);
    const data = await res.json();

    const esValido = data.status === "valid" && data.sub_status === "permitted";

    if (esValido) {
      correoMensaje.textContent = "Correo válido";
      correoMensaje.classList.add("ok");
      correoValido = true;
    } else {
      correoMensaje.textContent = "Correo no válido o no permitido";
      correoMensaje.classList.add("error");
      correoValido = false;
    }
  } catch (error) {
    console.error(error);
    correoMensaje.textContent = "Error al verificar correo";
    correoMensaje.classList.add("error");
    correoValido = false;
  }
}

correoInput.addEventListener("change", () => {
  const correo = correoInput.value.trim();
  if (correo) verificarCorreo(correo);
});

// Registro de usuarios
document.getElementById('registroForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  // datos del formulario...
  const cedula = document.getElementById('cedula').value.trim();
  const nombre = document.getElementById('nombre').value.trim();
  const apellido = document.getElementById('apellido').value.trim();
  const correo = document.getElementById('correo').value.trim();
  const telefono = document.getElementById('telefono').value.trim();
  const usuario = document.getElementById('usuarioNuevo').value.trim();
  const contrasena = document.getElementById('contrasenaNuevo').value.trim();
  const rol = document.getElementById('rol').value;

  const regexUsuario = /^[a-zA-Z]+$/;
  if (!regexUsuario.test(usuario)) {
    alert('El usuario solo puede contener letras.');
    return;
  }

  const regexContrasena = /^[a-zA-Z0-9]+$/;
  if (!regexContrasena.test(contrasena)) {
    alert('La contraseña solo puede contener letras y números.');
    return;
  }

  //Verificar que el teléfono esté verificado
  // if (!telefonoVerificado || telefono !== telefonoUsadoParaOTP) {
  // Swal.fire({
  //     icon: 'warning',
  //     title: 'Teléfono no verificado',
  //     text: 'Debes verificar el número por SMS antes de registrar al usuario.'
  //   });
  //   return;
  // }

  if (!correoValido) {
    Swal.fire({
      icon: 'warning',
      title: 'Correo inválido',
      text: 'Debes ingresar un correo válido antes de registrar.'
    });
    return;
  }

  if (!cedula || !nombre || !apellido || !correo || !telefono || !usuario || !contrasena || !rol) {
    Swal.fire({
      icon: 'warning',
      title: 'Campos incompletos',
      text: 'Por favor completa todos los campos.'
    });
    return;
  }

  try {
    const res = await fetch('/api/usuarios/registrar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cedula_usuario: cedula,
        nombre,
        apellido,
        correo,
        telefono,
        usuario,
        contrasena,
        rol
      })
    });

    const data = await res.json();

    if (res.ok && data.success) {
      Swal.fire({
        icon: 'success',
        title: '¡Usuario registrado!',
        text: data.message,
        confirmButtonColor: '#28a745'
      });
      document.getElementById('registroForm').reset();
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: data.message || data.error || 'Error al registrar usuario.'
      });
    }

  } catch (error) {
    console.error(error);
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Error en la comunicación con el servidor.'
    });
  }
});